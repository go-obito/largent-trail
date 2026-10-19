"""JWT verification behind the application's authentication-provider seam."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Protocol

import httpx
import jwt
import structlog


class TokenExpired(Exception):
    """The bearer token is validly signed but past its expiration time."""


class InvalidToken(Exception):
    """The bearer token failed verification or required claim checks."""


class AuthProviderUnavailable(Exception):
    """The provider's key set could not be loaded and no cached key is usable."""


@dataclass(frozen=True, slots=True)
class VerifiedIdentity:
    provider: str
    subject: str
    email: str | None = None
    display_name: str | None = None


class AuthProvider(Protocol):
    async def verify(self, token: str) -> VerifiedIdentity: ...


class ClerkAuthProvider:
    """Verify Clerk session JWTs using an issuer-pinned, cached JWKS."""

    def __init__(
        self,
        *,
        issuer: str,
        audience: str | None,
        authorized_parties: list[str],
        jwks_url: str | None = None,
        jwks_ttl_seconds: int = 300,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.authorized_parties = frozenset(authorized_parties)
        self.jwks_url = jwks_url or f"{self.issuer}/.well-known/jwks.json"
        self.jwks_ttl_seconds = jwks_ttl_seconds
        self._client = client or httpx.AsyncClient(timeout=5.0)
        self._owns_client = client is None
        self._keys: dict[str, jwt.PyJWK] = {}
        self._expires_at = 0.0
        self._last_unknown_kid_refresh: float | None = None
        self._lock = asyncio.Lock()
        self._logger = structlog.get_logger(__name__)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def verify(self, token: str) -> VerifiedIdentity:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError as exc:
            raise InvalidToken from exc

        if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
            raise InvalidToken
        key = await self._key_for_kid(header["kid"])

        required = ["sub", "exp", "nbf", "iss"]
        if self.audience is not None:
            required.append("aud")
        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self.issuer,
                audience=self.audience,
                leeway=10,
                # PyJWT rejects any token carrying aud when no audience is passed.
                options={"require": required, "verify_aud": self.audience is not None},
            )
        except jwt.ExpiredSignatureError as exc:
            raise TokenExpired from exc
        except jwt.InvalidTokenError as exc:
            raise InvalidToken from exc

        subject = claims.get("sub")
        authorized_party = claims.get("azp")
        if not isinstance(subject, str) or not subject:
            raise InvalidToken
        if len(subject) > 255:
            raise InvalidToken
        if not isinstance(authorized_party, str) or authorized_party not in self.authorized_parties:
            raise InvalidToken

        email = claims.get("email")
        display_name = claims.get("display_name")
        if email is not None and not isinstance(email, str):
            email = None
        if display_name is not None and not isinstance(display_name, str):
            display_name = None
        if email is not None and len(email) > 254:
            email = None
        if display_name is not None and len(display_name) > 100:
            display_name = None
        return VerifiedIdentity("clerk", subject, email, display_name)

    async def _key_for_kid(self, kid: str) -> jwt.PyJWK:
        async with self._lock:
            now = time.monotonic()
            refreshed = False
            if now >= self._expires_at:
                await self._refresh()
                refreshed = True

            key = self._keys.get(kid)
            can_refresh_unknown = self._last_unknown_kid_refresh is None or (
                now - self._last_unknown_kid_refresh >= 60
            )
            if key is None and not refreshed and can_refresh_unknown:
                self._last_unknown_kid_refresh = now
                await self._refresh()
                key = self._keys.get(kid)

            if key is None:
                raise InvalidToken
            return key

    async def _refresh(self) -> None:
        try:
            response = await self._client.get(self.jwks_url)
            response.raise_for_status()
            body = response.json()
            raw_keys = body.get("keys") if isinstance(body, dict) else None
            if not isinstance(raw_keys, list):
                raise ValueError("JWKS keys must be a list")
            keys: dict[str, jwt.PyJWK] = {}
            for raw_key in raw_keys:
                if not isinstance(raw_key, dict) or not isinstance(raw_key.get("kid"), str):
                    continue
                if raw_key.get("kty") != "RSA" or raw_key.get("use", "sig") != "sig":
                    continue
                if raw_key.get("alg", "RS256") != "RS256":
                    continue
                try:
                    keys[raw_key["kid"]] = jwt.PyJWK.from_dict(raw_key, algorithm="RS256")
                except (jwt.InvalidKeyError, jwt.PyJWKError, ValueError):
                    continue
            if not keys:
                raise ValueError("JWKS contains no usable RS256 keys")
        except (httpx.HTTPError, ValueError, jwt.PyJWKError) as exc:
            if not self._keys:
                raise AuthProviderUnavailable from exc
            self._logger.warning("auth_jwks_refresh_failed", reason_code="jwks_unavailable")
            return

        self._keys = keys
        self._expires_at = time.monotonic() + self.jwks_ttl_seconds

"""JWT verification tests use locally generated RSA keys and an in-memory JWKS endpoint."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from tests.conftest import make_settings

from largent.core.config import Settings
from largent.core.security import (
    AuthProviderUnavailable,
    ClerkAuthProvider,
    InvalidToken,
    TokenExpired,
)

ISSUER = "https://clerk.test"
AUDIENCE = "largent-api"
AUTHORIZED_PARTY = "http://localhost:3000"


def _rsa_key(kid: str) -> tuple[rsa.RSAPrivateKey, dict[str, Any]]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return private_key, public_jwk


def _token(
    private_key: rsa.RSAPrivateKey,
    *,
    kid: str = "key-1",
    changes: dict[str, object] | None = None,
    remove: tuple[str, ...] = (),
) -> str:
    claims: dict[str, object] = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "azp": AUTHORIZED_PARTY,
        "sub": "user_123",
        "iat": int(time.time()),
        "nbf": int(time.time()) - 1,
        "exp": int(time.time()) + 300,
        "email": "person@example.com",
        "display_name": "Example Person",
    }
    claims.update(changes or {})
    for claim in remove:
        claims.pop(claim, None)
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": kid})


def _provider(
    jwks: Callable[[], list[dict[str, Any]]],
) -> tuple[ClerkAuthProvider, httpx.AsyncClient]:
    def handle(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"keys": jwks()})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
    provider = ClerkAuthProvider(
        issuer=ISSUER,
        audience=AUDIENCE,
        authorized_parties=[AUTHORIZED_PARTY],
        client=client,
    )
    return provider, client


@pytest.fixture
def signing_key() -> tuple[rsa.RSAPrivateKey, dict[str, Any]]:
    return _rsa_key("key-1")


async def test_valid_token_returns_only_allowlisted_identity_claims(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, jwk = signing_key
    provider, client = _provider(lambda: [jwk])
    try:
        identity = await provider.verify(_token(private_key))
    finally:
        await client.aclose()

    assert identity.provider == "clerk"
    assert identity.subject == "user_123"
    assert identity.email == "person@example.com"
    assert identity.display_name == "Example Person"
    assert set(identity.__dataclass_fields__) == {"provider", "subject", "email", "display_name"}


@pytest.mark.parametrize(
    ("changes", "error"),
    [
        ({"exp": int(time.time()) - 30}, TokenExpired),
        ({"nbf": "future"}, InvalidToken),
        ({"iss": "https://wrong-issuer.test"}, InvalidToken),
        ({"aud": "wrong-audience"}, InvalidToken),
        ({"azp": "https://wrong-party.test"}, InvalidToken),
        ({"azp": None}, InvalidToken),
        ({"sub": None}, InvalidToken),
        ({"__remove__": "azp"}, InvalidToken),
        ({"__remove__": "sub"}, InvalidToken),
    ],
)
async def test_invalid_claims_fail_closed(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
    changes: dict[str, object],
    error: type[Exception],
) -> None:
    private_key, jwk = signing_key
    provider, client = _provider(lambda: [jwk])
    try:
        if changes.get("nbf") == "future":
            changes["nbf"] = int(time.time()) + 60
        remove = (str(changes.pop("__remove__")),) if "__remove__" in changes else ()
        with pytest.raises(error):
            await provider.verify(_token(private_key, changes=changes, remove=remove))
    finally:
        await client.aclose()


async def test_unsupported_and_confused_algorithms_are_rejected(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, jwk = signing_key
    provider, client = _provider(lambda: [jwk])
    claims = {"iss": ISSUER, "aud": AUDIENCE, "sub": "user_123"}
    try:
        none_header = base64.urlsafe_b64encode(
            json.dumps({"alg": "none", "kid": "key-1"}, separators=(",", ":")).encode()
        ).rstrip(b"=")
        none_payload = base64.urlsafe_b64encode(
            json.dumps(claims, separators=(",", ":")).encode()
        ).rstrip(b"=")
        none_token = b".".join((none_header, none_payload, b"")).decode()
        hs_header = base64.urlsafe_b64encode(
            json.dumps({"alg": "HS256", "kid": "key-1"}, separators=(",", ":")).encode()
        ).rstrip(b"=")
        hs_payload = base64.urlsafe_b64encode(
            json.dumps(claims, separators=(",", ":")).encode()
        ).rstrip(b"=")
        public_key = private_key.public_key().public_bytes(
            Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
        )
        signing_input = hs_header + b"." + hs_payload
        signature = hmac.new(public_key, signing_input, hashlib.sha256).digest()
        hs_token = b".".join(
            (hs_header, hs_payload, base64.urlsafe_b64encode(signature).rstrip(b"="))
        ).decode()
        for token in (none_token, hs_token):
            with pytest.raises(InvalidToken):
                await provider.verify(token)
        valid_token = _token(private_key)
        tampered = valid_token[:-1] + ("a" if valid_token[-1] != "a" else "b")
        with pytest.raises(InvalidToken):
            await provider.verify(tampered)
    finally:
        await client.aclose()


async def test_jwks_is_cached_between_requests(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, jwk = signing_key
    requests = 0

    def keys() -> list[dict[str, Any]]:
        nonlocal requests
        requests += 1
        return [jwk]

    provider, client = _provider(keys)
    try:
        await provider.verify(_token(private_key))
        await provider.verify(_token(private_key))
    finally:
        await client.aclose()
    assert requests == 1


async def test_expiration_and_not_before_allow_ten_second_leeway(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, jwk = signing_key
    provider, client = _provider(lambda: [jwk])
    try:
        await provider.verify(
            _token(private_key, changes={"exp": int(time.time()) - 5, "nbf": int(time.time()) + 5})
        )
    finally:
        await client.aclose()


async def test_unknown_kid_refetch_is_rate_limited(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, jwk = signing_key
    requests = 0

    def keys() -> list[dict[str, Any]]:
        nonlocal requests
        requests += 1
        return [jwk]

    provider, client = _provider(keys)
    try:
        await provider.verify(_token(private_key))
        for _ in range(2):
            with pytest.raises(InvalidToken):
                await provider.verify(_token(private_key, kid="unknown-key"))
    finally:
        await client.aclose()
    assert requests == 2


async def test_rotated_key_triggers_one_refetch(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    old_private, old_jwk = signing_key
    new_private, new_jwk = _rsa_key("key-2")
    requests = 0

    def keys() -> list[dict[str, Any]]:
        nonlocal requests
        requests += 1
        return [old_jwk] if requests == 1 else [new_jwk]

    provider, client = _provider(keys)
    try:
        await provider.verify(_token(old_private, kid="key-1"))
        await provider.verify(_token(new_private, kid="key-2"))
        await provider.verify(_token(new_private, kid="key-2"))
    finally:
        await client.aclose()
    assert requests == 2


async def test_unreachable_uncached_jwks_fails_with_provider_unavailable(
    signing_key: tuple[rsa.RSAPrivateKey, dict[str, Any]],
) -> None:
    private_key, _ = signing_key

    def fail(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("private endpoint detail")

    client = httpx.AsyncClient(transport=httpx.MockTransport(fail))
    provider = ClerkAuthProvider(
        issuer=ISSUER,
        audience=AUDIENCE,
        authorized_parties=[AUTHORIZED_PARTY],
        client=client,
    )
    try:
        with pytest.raises(AuthProviderUnavailable):
            await provider.verify(_token(private_key))
    finally:
        await client.aclose()


def test_clerk_provider_requires_issuer_audience_and_authorized_parties() -> None:
    with pytest.raises(ValueError, match="CLERK_AUDIENCE"):
        Settings.model_validate(make_settings(clerk_audience=None).model_dump(by_alias=True))


def test_system_iana_timezone_data_is_available() -> None:
    assert ZoneInfo("Africa/Accra").key == "Africa/Accra"
    with pytest.raises(ZoneInfoNotFoundError):
        ZoneInfo("Not/A_Zone")

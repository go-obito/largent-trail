"""Test-only deterministic auth provider; never imported by application code."""

from __future__ import annotations

from largent.core.security import InvalidToken, VerifiedIdentity


class FakeAuthProvider:
    def __init__(self, identities: dict[str, VerifiedIdentity]) -> None:
        self.identities = identities

    async def verify(self, token: str) -> VerifiedIdentity:
        try:
            return self.identities[token]
        except KeyError as exc:
            raise InvalidToken from exc

    async def aclose(self) -> None:
        return None

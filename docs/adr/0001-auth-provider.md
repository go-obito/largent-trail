# ADR 0001: Authentication Provider

- Status: Accepted
- Date: 2026-10-18

## Context

The MVP needs email one-time-code and Google sign-in without owning password
storage, recovery, or account security. Clerk provides those identity workflows
and issues session JWTs that the API can verify locally. The API must not depend
on provider API availability for each authenticated request.

## Decision

Use Clerk for the MVP and verify session JWTs only. `ClerkAuthProvider` fetches
and caches the issuer's JWKS, pins verification to RS256, and validates issuer,
audience, expiration, not-before, subject, and the configured authorized-party
allowlist. The provider SDK and Clerk backend API are not used. Tokens are read
only from the `Authorization: Bearer` header.

The `AuthProvider` protocol is the provider boundary. It returns only the
provider name, subject, optional email, and optional display name. Replacing
Clerk requires a new provider implementation and settings, a matching JWT/JWKS
contract, and tests for its claims and key rotation; user provisioning and
tenant-scoped API behavior remain provider-independent.

Production startup accepts only `AUTH_PROVIDER=clerk`. Other environments may
use test providers supplied by tests, but no fake provider ships under `src/`.

## Consequences

- `pyjwt[crypto]` supplies maintained JWT and cryptographic verification; `httpx`
	is runtime because JWKS retrieval is asynchronous.
- Issuer, audience, and authorized parties must be configured explicitly.
- Unknown signing keys trigger a rate-limited JWKS refresh and fail closed.
- Provider outages with no usable cached keys return a 503 problem response.
- Rate limiting failed authentication attempts remains deferred to B10.
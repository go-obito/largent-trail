"""Bounded, SSRF-safe fetching of public HTML pages.

This module deliberately does not try to work around bot protection.  A fresh
client and a fresh pinned connection are used for every redirect hop so that a
hostname cannot resolve to a safe address during validation and a different
address during connection.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import StrEnum
from typing import cast
from urllib.parse import SplitResult, urlsplit, urlunsplit

import httpcore
import httpx
from httpcore._backends.anyio import AnyIOBackend

MAX_URL_LENGTH = 2048
MAX_REDIRECTS = 3
MAX_DECODED_BODY_BYTES = 1_500_000
CONNECT_TIMEOUT_SECONDS = 3.0
TOTAL_TIMEOUT_SECONDS = 8.0

_USER_AGENT = "LargentBot/1.0"
_ACCEPTED_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}
_BLOCKED_STATUSES = {401, 403, 429}
_BOT_CHECK_MARKERS = (
    "captcha",
    "verify you are human",
    "unusual traffic",
    "access denied",
    "cloudflare",
)


class FetchStatus(StrEnum):
    SUCCESS = "success"
    BLOCKED = "blocked"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class SafeFetchResult:
    """The deliberately small result exposed to metadata extraction."""

    status: FetchStatus
    url: str
    content: bytes | None = None
    content_type: str | None = None


class SafeFetchError(ValueError):
    """A URL is invalid or cannot safely be fetched."""


class _PinnedNetworkBackend(httpcore.AsyncNetworkBackend):
    """Connect to one validated IP while httpcore retains the original SNI host."""

    def __init__(self, address: str) -> None:
        self._address = address
        self._backend = AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,  # noqa: ASYNC109 - protocol compatibility
        local_address: str | None = None,
        socket_options: object | None = None,
    ) -> httpcore.AsyncNetworkStream:
        # `host` is intentionally ignored only for TCP. httpcore subsequently
        # starts TLS using the request's original host, preserving SNI.
        return await self._backend.connect_tcp(
            self._address,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,  # type: ignore[arg-type]
        )

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,  # noqa: ASYNC109 - protocol compatibility
        socket_options: object | None = None,
    ) -> httpcore.AsyncNetworkStream:
        raise RuntimeError("Unix sockets are not permitted for safe fetches")

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class _AsyncResponseStream(httpx.AsyncByteStream):
    """Adapt httpcore's response stream to httpx's transport interface."""

    def __init__(self, stream: AsyncIterator[bytes]) -> None:
        self._stream = stream

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for part in self._stream:
            yield part

    async def aclose(self) -> None:
        await self._stream.aclose()  # type: ignore[attr-defined]


class _PinnedTransport(httpx.AsyncBaseTransport):
    """Minimal httpx transport using a TCP backend pinned to one IP address."""

    def __init__(self, address: str) -> None:
        self._pool = httpcore.AsyncConnectionPool(
            max_connections=1,
            max_keepalive_connections=0,
            http2=False,
            retries=0,
            network_backend=_PinnedNetworkBackend(address),
        )

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        core_request = httpcore.Request(
            method=request.method,
            url=httpcore.URL(
                scheme=request.url.raw_scheme,
                host=request.url.raw_host,
                port=request.url.port,
                target=request.url.raw_path,
            ),
            headers=request.headers.raw,
            content=request.stream,
            extensions=request.extensions,
        )
        core_response = await self._pool.handle_async_request(core_request)
        return httpx.Response(
            status_code=core_response.status,
            headers=core_response.headers,
            stream=_AsyncResponseStream(cast(AsyncIterator[bytes], core_response.stream)),
            extensions=core_response.extensions,
            request=request,
        )

    async def aclose(self) -> None:
        await self._pool.aclose()


def _validated_url(value: str) -> SplitResult:
    if not value or len(value) > MAX_URL_LENGTH:
        raise SafeFetchError("URL must be between 1 and 2048 characters")
    if any(ord(character) < 33 or ord(character) == 127 for character in value):
        raise SafeFetchError("URL must not contain whitespace or control characters")
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError as exc:
        raise SafeFetchError("URL is invalid") from exc
    if parts.scheme.lower() != "https" or parts.hostname is None:
        raise SafeFetchError("Only HTTPS URLs are allowed")
    if parts.username is not None or parts.password is not None:
        raise SafeFetchError("URL credentials are not allowed")
    if port not in (None, 443):
        raise SafeFetchError("Only port 443 is allowed")
    hostname = parts.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise SafeFetchError("The URL host is not public")
    return parts


def _is_public_address(value: str) -> bool:
    address = ipaddress.ip_address(value)
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return (
        not (
            address.is_loopback
            or address.is_private
            or address.is_link_local
            or address.is_multicast
            or address.is_reserved
            or address.is_unspecified
        )
        and address.is_global
    )


async def _resolve_public_address(hostname: str) -> str:
    try:
        records = await asyncio.get_running_loop().getaddrinfo(
            hostname, 443, type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        raise SafeFetchError("The URL host could not be resolved") from exc
    addresses = {record[4][0] for record in records}
    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise SafeFetchError("The URL host is not public")
    # A deterministic selection makes the pinned destination explicit. Every
    # result was checked above; a later DNS lookup is never used for connection.
    return sorted(addresses)[0]


def _canonical_url(parts: SplitResult) -> str:
    return urlunsplit(("https", parts.netloc, parts.path or "/", parts.query, ""))


def _is_bot_check(content: bytes) -> bool:
    # Only inspect a small prefix. This is a classification hint, not an attempt
    # to evade bot checks, and it avoids decoding a large response twice.
    text = content[:16_384].decode("utf-8", errors="ignore").lower()
    return any(marker in text for marker in _BOT_CHECK_MARKERS)


async def _read_html(response: httpx.Response) -> bytes | None:
    content_type = response.headers.get("content-type", "").split(";", 1)[0].lower().strip()
    if content_type not in _ACCEPTED_CONTENT_TYPES:
        return None
    body = bytearray()
    async for chunk in response.aiter_bytes():
        body.extend(chunk)
        if len(body) > MAX_DECODED_BODY_BYTES:
            return None
    return bytes(body)


async def safe_fetch(url: str) -> SafeFetchResult:
    """Fetch a public HTML page without allowing DNS rebinding or state reuse."""
    current_url = url
    try:
        async with asyncio.timeout(TOTAL_TIMEOUT_SECONDS):
            for redirect_count in range(MAX_REDIRECTS + 1):
                parts = _validated_url(current_url)
                address = await _resolve_public_address(parts.hostname or "")
                canonical_url = _canonical_url(parts)
                transport = _PinnedTransport(address)
                timeout = httpx.Timeout(
                    connect=CONNECT_TIMEOUT_SECONDS,
                    read=TOTAL_TIMEOUT_SECONDS,
                    write=TOTAL_TIMEOUT_SECONDS,
                    pool=CONNECT_TIMEOUT_SECONDS,
                )
                async with httpx.AsyncClient(
                    transport=transport,
                    follow_redirects=False,
                    timeout=timeout,
                    headers={
                        "User-Agent": _USER_AGENT,
                        "Accept": "text/html,application/xhtml+xml",
                        "Accept-Language": "en",
                    },
                    trust_env=False,
                ) as client:
                    response = await client.get(canonical_url)
                    try:
                        if response.status_code in _BLOCKED_STATUSES:
                            return SafeFetchResult(FetchStatus.BLOCKED, canonical_url)
                        if response.is_redirect:
                            location = response.headers.get("location")
                            if location is None or redirect_count == MAX_REDIRECTS:
                                return SafeFetchResult(FetchStatus.FAILED, canonical_url)
                            current_url = str(response.url.join(location))
                            continue
                        body = await _read_html(response)
                    finally:
                        await response.aclose()
                if body is None:
                    return SafeFetchResult(FetchStatus.FAILED, canonical_url)
                if _is_bot_check(body):
                    return SafeFetchResult(FetchStatus.BLOCKED, canonical_url)
                return SafeFetchResult(
                    FetchStatus.SUCCESS,
                    canonical_url,
                    content=body,
                    content_type=response.headers.get("content-type"),
                )
    except (SafeFetchError, httpx.HTTPError, OSError, TimeoutError):
        return SafeFetchResult(FetchStatus.FAILED, current_url)
    return SafeFetchResult(FetchStatus.FAILED, current_url)

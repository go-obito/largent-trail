"""Untrusted product-page metadata extraction for need import previews.

The parser treats all page contents as data. It never executes scripts, follows
page instructions, or exposes the HTML it was given.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import re
import socket
import unicodedata
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx

MAX_TITLE_LENGTH = 100
MAX_ORIGINAL_PRICE = Decimal("1000000000")
_MINOR_UNIT = Decimal("0.01")
_PRICE_CANDIDATE = re.compile(r"\d(?:[\d\s,.]*\d)?")
_TITLE_SEPARATORS = (" | ", " — ", " - ", " :: ")
_SITE_NAME_MARKERS = (".", "amazon", "jiji", "ebay", "walmart", "shop")
_PRICE_META_KEYS = ("og:price:amount", "product:price:amount")
_CURRENCY_META_KEYS = ("og:price:currency", "product:price:currency")
_BRAND_META_KEYS = ("product:brand", "og:brand", "brand")


@dataclass(frozen=True, slots=True)
class LinkImportSuggestion:
    """Safely extracted product fields; each may be absent on a blocked page."""

    name: str | None
    target_minor: int | None
    price_currency: str | None


class _MetadataParser(HTMLParser):
    """Collect only metadata values and JSON-LD script contents."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title_parts: list[str] = []
        self.json_ld_blocks: list[str] = []
        self._in_title = False
        self._json_ld_parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value for key, value in attrs if value is not None}
        if tag.lower() == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = attributes.get("content")
            if key and content is not None and key not in self.meta:
                self.meta[key] = content
        elif tag.lower() == "title":
            self._in_title = True
        elif tag.lower() == "script":
            script_type = attributes.get("type", "").split(";", 1)[0].strip().lower()
            if script_type == "application/ld+json":
                self._json_ld_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False
        elif tag.lower() == "script" and self._json_ld_parts is not None:
            self.json_ld_blocks.append("".join(self._json_ld_parts))
            self._json_ld_parts = None

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._json_ld_parts is not None:
            self._json_ld_parts.append(data)


def _clean_title(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    title = " ".join(unicodedata.normalize("NFC", value).split())
    if not title:
        return None
    for separator in _TITLE_SEPARATORS:
        if separator not in title:
            continue
        candidate, suffix = title.rsplit(separator, 1)
        if candidate and any(marker in suffix.casefold() for marker in _SITE_NAME_MARKERS):
            title = candidate
            break
    return title[:MAX_TITLE_LENGTH] or None


def _normalize_number(value: str) -> str | None:
    candidate_match = _PRICE_CANDIDATE.search(value)
    if candidate_match is None:
        return None
    candidate = candidate_match.group().replace(" ", "")
    comma_count = candidate.count(",")
    dot_count = candidate.count(".")
    if comma_count and dot_count:
        decimal_separator = "," if candidate.rfind(",") > candidate.rfind(".") else "."
        grouping_separator = "." if decimal_separator == "," else ","
        return candidate.replace(grouping_separator, "").replace(decimal_separator, ".")
    separator = "," if comma_count else "." if dot_count else None
    if separator is None:
        return candidate
    parts = candidate.split(separator)
    last_part = parts[-1]
    if len(parts) > 2 and len(last_part) == 3:
        return "".join(parts)
    if len(parts) == 2 and len(last_part) == 3:
        return "".join(parts)
    return "".join(parts[:-1]) + "." + last_part


def parse_price_minor(value: object) -> int | None:
    """Parse a human-formatted positive price into pesewas without floats."""
    if isinstance(value, bool) or value is None:
        return None
    text = value if isinstance(value, str) else str(value)
    normalized = _normalize_number(text)
    if normalized is None:
        return None
    try:
        amount = Decimal(normalized)
    except InvalidOperation:
        return None
    if not amount.is_finite() or amount <= 0 or amount > MAX_ORIGINAL_PRICE:
        return None
    return int(amount.quantize(_MINOR_UNIT, rounding=ROUND_HALF_UP) * 100)


def _currency(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    currency = value.strip().upper()
    return currency if len(currency) == 3 and currency.isalpha() else None


def _is_product(entry: object) -> bool:
    if not isinstance(entry, dict):
        return False
    product_type = entry.get("@type")
    if isinstance(product_type, str):
        return product_type.casefold() == "product"
    if isinstance(product_type, list):
        return any(isinstance(item, str) and item.casefold() == "product" for item in product_type)
    return False


def _product_entries(value: object) -> list[dict[str, object]]:
    if isinstance(value, list):
        return [entry for item in value for entry in _product_entries(item)]
    if not isinstance(value, dict):
        return []
    entries = [value] if _is_product(value) else []
    graph = value.get("@graph")
    if isinstance(graph, list):
        entries.extend(entry for item in graph for entry in _product_entries(item))
    return entries


def _offer_price(product: dict[str, object]) -> tuple[int | None, str | None]:
    offers = product.get("offers")
    offer_list = offers if isinstance(offers, list) else [offers]
    for offer in offer_list:
        if not isinstance(offer, dict):
            continue
        for field in ("price", "lowPrice"):
            price = parse_price_minor(offer.get(field))
            if price is not None:
                return price, _currency(offer.get("priceCurrency"))
    return None, None


def _json_ld_suggestion(blocks: list[str]) -> LinkImportSuggestion:
    for block in blocks:
        try:
            decoded = json.loads(block)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        for product in _product_entries(decoded):
            name = _clean_title(product.get("name"))
            raw_brand = product.get("brand")
            if isinstance(raw_brand, dict):
                raw_brand = raw_brand.get("name")
            brand = _clean_title(raw_brand)
            if name is not None and brand is not None:
                if not name.casefold().startswith(brand.casefold()):
                    name = _clean_title(f"{brand} {name}")
            price, currency = _offer_price(product)
            if name is not None or price is not None:
                return LinkImportSuggestion(name, price, currency)
    return LinkImportSuggestion(None, None, None)


def _first_meta(meta: dict[str, str], keys: tuple[str, ...]) -> str | None:
    return next((meta[key] for key in keys if key in meta), None)


def extract_link_import_suggestion(html: bytes) -> LinkImportSuggestion:
    """Extract a bounded preview suggestion from fetched HTML bytes.

    Parsing failures intentionally result in missing suggestions rather than an
    exception; import preview is best-effort.
    """
    parser = _MetadataParser()
    try:
        parser.feed(html.decode("utf-8", errors="replace"))
        parser.close()
    except (ValueError, UnicodeError):
        return LinkImportSuggestion(None, None, None)

    json_ld = _json_ld_suggestion(parser.json_ld_blocks)
    name = json_ld.name or _clean_title(parser.meta.get("og:title"))
    name = name or _clean_title("".join(parser.title_parts))
    brand = _clean_title(_first_meta(parser.meta, _BRAND_META_KEYS))
    if name is not None and brand is not None:
        if not name.casefold().startswith(brand.casefold()):
            name = _clean_title(f"{brand} {name}")
    price = json_ld.target_minor
    currency = json_ld.price_currency
    if price is None:
        price = parse_price_minor(_first_meta(parser.meta, _PRICE_META_KEYS))
        currency = _currency(_first_meta(parser.meta, _CURRENCY_META_KEYS))
    return LinkImportSuggestion(name, price, currency)


MAX_PAGE_BYTES = 1_000_000
MAX_REDIRECTS = 3
_ALLOWED_PORTS = {80, 443}


class LinkImportFetchError(Exception):
    """A product page could not be fetched safely or did not return HTML."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


async def _validate_public_url(url: str) -> None:
    """Reject non-web URLs and hosts resolving to non-public IP addresses."""
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise LinkImportFetchError("invalid_url") from None

    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or (port is not None and port not in _ALLOWED_PORTS)
    ):
        raise LinkImportFetchError("url_not_allowed")

    try:
        host = parsed.hostname.rstrip(".").encode("idna").decode("ascii")
    except UnicodeError:
        raise LinkImportFetchError("invalid_url") from None
    if host.casefold() in {"localhost", "localhost.localdomain"}:
        raise LinkImportFetchError("url_not_allowed")

    try:
        records = await asyncio.to_thread(
            socket.getaddrinfo,
            host,
            port or (443 if parsed.scheme == "https" else 80),
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )
    except OSError:
        raise LinkImportFetchError("link_unavailable") from None

    addresses = {record[4][0] for record in records}
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise LinkImportFetchError("url_not_allowed")


async def fetch_link_import_suggestion(url: str) -> LinkImportSuggestion:
    """Fetch a public product page with bounded size, time, and redirects."""
    current_url = url
    timeout = httpx.Timeout(8.0, connect=4.0)
    headers = {
        "Accept": "text/html,application/xhtml+xml;q=0.9",
        "User-Agent": "LargentLinkPreview/1.0 (+https://largent.site)",
    }

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
        headers=headers,
    ) as client:
        for redirect_count in range(MAX_REDIRECTS + 1):
            await _validate_public_url(current_url)
            try:
                async with client.stream("GET", current_url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location or redirect_count >= MAX_REDIRECTS:
                            raise LinkImportFetchError("link_unavailable")
                        current_url = urljoin(current_url, location)
                        continue
                    if response.status_code in {403, 429}:
                        raise LinkImportFetchError("site_blocked")
                    if response.status_code >= 400:
                        raise LinkImportFetchError("link_unavailable")
                    content_type = response.headers.get("content-type", "").lower()
                    if (
                        "text/html" not in content_type
                        and "application/xhtml+xml" not in content_type
                    ):
                        raise LinkImportFetchError("not_a_product_page")
                    content_length = response.headers.get("content-length")
                    if content_length:
                        try:
                            declared_size = int(content_length)
                        except ValueError:
                            raise LinkImportFetchError("link_unavailable") from None
                        if declared_size > MAX_PAGE_BYTES:
                            raise LinkImportFetchError("page_too_large")
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > MAX_PAGE_BYTES:
                            raise LinkImportFetchError("page_too_large")
                        chunks.append(chunk)
                    return extract_link_import_suggestion(b"".join(chunks))
            except httpx.TimeoutException:
                raise LinkImportFetchError("fetch_timeout") from None
            except httpx.HTTPError:
                raise LinkImportFetchError("link_unavailable") from None

    raise LinkImportFetchError("link_unavailable")

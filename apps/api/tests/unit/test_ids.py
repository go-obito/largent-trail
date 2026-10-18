"""UUIDv7 helper tests."""

from __future__ import annotations

from uuid import UUID, uuid1, uuid4

from largent.core.ids import is_uuid7, new_uuid7


def test_new_uuid7_returns_rfc_4122_uuid7() -> None:
    value = new_uuid7()
    assert isinstance(value, UUID)
    assert is_uuid7(value)
    assert is_uuid7(str(value))


def test_is_uuid7_rejects_other_values() -> None:
    assert not is_uuid7(UUID("018f0000-0000-4000-8000-00000000000a"))
    assert not is_uuid7("not-a-uuid")
    assert not is_uuid7(7)


def test_is_uuid7_rejects_other_versions_and_variants() -> None:
    assert not is_uuid7(uuid4())
    assert not is_uuid7(uuid1())
    assert not is_uuid7(UUID(int=0))
    wrong_variant = UUID("018f0000-0000-7000-c000-00000000000a")
    assert not is_uuid7(wrong_variant)


def test_is_uuid7_accepts_uppercase_strings_and_rejects_none() -> None:
    value = new_uuid7()
    assert is_uuid7(str(value).upper())
    assert not is_uuid7(None)
    assert not is_uuid7(value.bytes)


def test_new_uuid7_values_are_unique_and_time_ordered() -> None:
    values = [new_uuid7() for _ in range(50)]
    assert len(set(values)) == 50
    assert [value.int >> 80 for value in values] == sorted(value.int >> 80 for value in values)

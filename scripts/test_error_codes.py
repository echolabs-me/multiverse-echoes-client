"""Every code the server sends has its text in `en.json`, and `errors` holds
the codes and nothing else (R282.4, R308).

A code has its text when `errors.<CODE>` is a string with at least one
character that is not white space (R300.1): an absent key, the empty string,
white space only, and a value that is not a string each leave it without one.

The codes are the list in `crates/api/src/error_code.rs`, the one place the
server defines them (R282.1). This suite reads that list and `en.json`, and
nothing else: it fails when it cannot read the list, when a code has no
`errors.<CODE>` key, and when a key under `errors` is not a code. Text the
client shows for an error of its own lives under `clientErrors` (R308.1), so
the suite never needs to read client code.

It runs in both workflows, as every `client/scripts` suite does (R275):
`ci.yml`'s `python` job and `CI (Client)`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[2]
CODES_RS = ROOT / "crates" / "api" / "src" / "error_code.rs"
EN_JSON = ROOT / "client" / "src" / "locales" / "en.json"

_OPEN = "error_codes! {"
_ENTRY = re.compile(r'^    [A-Z][A-Za-z0-9]* = "([A-Z][A-Z0-9_]*)",$')


def read_codes(text: str) -> list[str]:
    """The codes in `error_code.rs`'s list, in order.

    The list is the lines between `error_codes! {` and the next line that is
    `}`. Each must be `    Name = "CODE",`; any other line, a missing
    list, or an empty one is an error, so the suite never passes on a list it
    did not read.
    """
    lines = text.splitlines()
    starts = [i for i, line in enumerate(lines) if line == _OPEN]
    if len(starts) != 1:
        raise ValueError(f"error_code.rs: expected one line `{_OPEN}`, found {len(starts)}")
    codes: list[str] = []
    for number, line in enumerate(lines[starts[0] + 1 :], start=starts[0] + 2):
        if line == "}":
            break
        entry = _ENTRY.match(line)
        if entry is None:
            raise ValueError(f"error_code.rs:{number}: not a list entry: {line!r}")
        codes.append(entry.group(1))
    else:
        raise ValueError("error_code.rs: the list is never closed")
    if not codes:
        raise ValueError("error_code.rs: the list is empty")
    return codes


def errors_section(en: dict[str, Any]) -> dict[str, Any]:
    """`en.json`'s `errors` object; one that is missing reads as empty, so
    every code then lacks its text."""
    section = en.get("errors", {})
    if not isinstance(section, dict):
        raise ValueError("en.json: `errors` is not an object")
    return section


def has_text(value: Any) -> bool:
    """A string with at least one character that is not white space."""
    return isinstance(value, str) and value.strip() != ""


def missing_texts(codes: list[str], errors: dict[str, Any]) -> list[str]:
    """The codes whose `errors.<CODE>` is not a text."""
    return [code for code in codes if not has_text(errors.get(code))]


def unclaimed_keys(codes: list[str], errors: dict[str, Any]) -> list[str]:
    """The keys under `errors` that are not a code."""
    known = set(codes)
    return sorted(key for key in errors if key not in known)


def test_each_code_has_its_text_and_errors_holds_the_codes_and_nothing_else() -> None:
    codes = read_codes(CODES_RS.read_text(encoding="utf-8"))
    errors = errors_section(json.loads(EN_JSON.read_text(encoding="utf-8")))
    assert missing_texts(codes, errors) == [], "codes with no errors.<CODE> text in en.json"
    assert unclaimed_keys(codes, errors) == [], "keys under errors that are no code"


LIST = 'error_codes! {\n    EchoNotFound = "ECHO_NOT_FOUND",\n    NewOne = "NEW_ONE",\n}\n'


def test_a_code_with_no_text_fails_until_its_key_is_there() -> None:
    codes = read_codes(LIST)
    assert missing_texts(codes, {"ECHO_NOT_FOUND": "Not found."}) == ["NEW_ONE"]
    assert missing_texts(codes, {"ECHO_NOT_FOUND": "Not found.", "NEW_ONE": "New."}) == []


@pytest.mark.parametrize(
    "value",
    ["", " \t\n", {"title": "Not found."}, 404, None],
    ids=["empty", "white space only", "an object", "a number", "null"],
)
def test_a_code_whose_value_is_no_text_is_missing(value: Any) -> None:
    errors = {"ECHO_NOT_FOUND": "Not found.", "NEW_ONE": value}
    assert missing_texts(read_codes(LIST), errors) == ["NEW_ONE"]


def test_no_errors_section_leaves_every_code_without_its_text() -> None:
    assert missing_texts(read_codes(LIST), errors_section({})) == ["ECHO_NOT_FOUND", "NEW_ONE"]


@pytest.mark.parametrize(
    "errors",
    [["ECHO_NOT_FOUND"], "Not found.", None],
    ids=["a list", "a string", "null"],
)
def test_an_errors_section_that_is_no_object_fails(errors: Any) -> None:
    with pytest.raises(ValueError, match="`errors` is not an object"):
        errors_section({"errors": errors})


@pytest.mark.parametrize(
    "value",
    ["Gone.", {"title": "Gone.", "body": "Long gone."}],
    ids=["a string", "an object"],
)
def test_a_key_under_errors_that_is_no_code_fails(value: Any) -> None:
    errors = {"ECHO_NOT_FOUND": "a", "NEW_ONE": "b", "stale": value}
    assert unclaimed_keys(read_codes(LIST), errors) == ["stale"]


@pytest.mark.parametrize(
    "text",
    [
        "no list here\n",
        'error_codes! {\n    EchoNotFound = "ECHO_NOT_FOUND"\n}\n',
        'error_codes! {\n    EchoNotFound = "ECHO_NOT_FOUND",\n',
        "error_codes! {\n}\n",
    ],
    ids=["no list", "a line that is no entry", "never closed", "empty"],
)
def test_a_list_it_cannot_read_fails(text: str) -> None:
    with pytest.raises(ValueError):
        read_codes(text)

#!/usr/bin/env python3
"""Synchronize the embedded, offline-ready catalog with restaurants.json.

restaurants.json is the single editable source; index.html includes a generated
copy for zero-request startup on GitHub Pages. Run --check in CI; --write after
editing the JSON catalog.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "restaurants.json"
PAGE = ROOT / "index.html"
TAG = re.compile(
    r'(<script\s+id="restaurant-data"\s+type="application/json">)'
    r'(.*?)'
    r'(</script>)',
    flags=re.DOTALL,
)

def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get("restaurants"), list):
        raise ValueError("Catalog must contain an array called restaurants.")
    rows = data["restaurants"]
    if not rows:
        raise ValueError("Catalog cannot be empty.")
    seen = set()
    for idx, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            raise ValueError(f"Row {idx} is not an object.")
        rid = row.get("id")
        if isinstance(rid, bool) or not isinstance(rid, int) or not 1 <= rid <= 999999:
            raise ValueError(f"Row {idx}: id must be an integer from 1 to 999999.")
        if rid in seen:
            raise ValueError(f"Duplicate restaurant id: {rid}.")
        seen.add(rid)
        for field in ("name", "address", "cuisine_group"):
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise ValueError(f"Restaurant {rid}: missing required field {field}.")
    return rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Validate source and embedded catalog.")
    mode.add_argument("--write", action="store_true", help="Regenerate the embedded catalog in index.html.")
    args = parser.parse_args()

    canonical = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = validate(canonical)
    html = PAGE.read_text(encoding="utf-8")
    matches = list(TAG.finditer(html))
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one restaurant-data script; found {len(matches)}.")
    embedded_raw = matches[0].group(2)
    embedded = json.loads(embedded_raw)
    if args.check:
        if "</script" in embedded_raw.lower():
            raise ValueError("Unsafe embedded script terminator in restaurant data.")
        if embedded != canonical:
            print("ERROR: catalog mismatch. Run python3 scripts/sync_catalog.py --write", file=sys.stderr)
            return 1
        print(f"Catalog verified: {len(rows)} restaurants; IDs unique; embedded JSON is in sync.")
        return 0

    # Escape '<' so restaurant names cannot close the HTML script element.
    serialized = json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    updated = html[:matches[0].start(2)] + serialized + html[matches[0].end(2):]
    if updated != html:
        PAGE.write_text(updated, encoding="utf-8")
        print(f"Updated index.html with {len(rows)} restaurants.")
    else:
        print(f"Catalog already synchronized: {len(rows)} restaurants.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

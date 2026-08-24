#!/usr/bin/env python3
"""Download public identifier catalogs. Names only — never lyrics or plot text."""

from __future__ import annotations

import json
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
OUT = BUILD / "identifiers.jsonl"
UA = "copyright-censor/0.1 (https://github.com/mikkel/copyright-censor; identifier compile; no lyrics)"

SOURCES = {
    "mb_artists": {
        "url": "https://huggingface.co/datasets/LeData/media-metadata-musicbrainz-artists/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "mb_artists.parquet",
    },
    "mb_songs": {
        "url": "https://huggingface.co/datasets/imseldrith/musicbrainz-all-songs/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "mb_songs.parquet",
    },
    "tvmaze": {
        "url": "https://huggingface.co/datasets/LeData/media-metadata-tvmaze-shows/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "tvmaze.parquet",
    },
    "steam": {
        "url": "https://huggingface.co/datasets/LeData/media-metadata-steam-games/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "steam.parquet",
    },
    "anilist": {
        "url": "https://huggingface.co/datasets/LeData/media-metadata-anilist-anime/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "anilist.parquet",
    },
    "manga": {
        "url": "https://huggingface.co/datasets/LeData/media-metadata-jikan-manga/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
        "path": BUILD / "manga.parquet",
    },
}

WD_QUERIES = [
    (
        "franchise",
        """
        SELECT ?name WHERE {
          ?item wdt:P31/wdt:P279* wd:Q196600 .
          ?item rdfs:label ?name .
          FILTER(LANG(?name) = "en")
        }
        """,
    ),
    (
        "franchise",
        """
        SELECT ?name WHERE {
          ?item wdt:P31/wdt:P279* wd:Q24856 .
          ?item rdfs:label ?name .
          FILTER(LANG(?name) = "en")
        }
        """,
    ),
    (
        "franchise",
        """
        SELECT ?name WHERE {
          ?item wdt:P31/wdt:P279* wd:Q7058673 .
          ?item rdfs:label ?name .
          FILTER(LANG(?name) = "en")
        }
        """,
    ),
    (
        "franchise",
        """
        SELECT ?name WHERE {
          ?item wdt:P31/wdt:P279* wd:Q559618 .
          ?item rdfs:label ?name .
          FILTER(LANG(?name) = "en")
        }
        """,
    ),
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"cached {dest.name} ({dest.stat().st_size} bytes)", flush=True)
        return
    print(f"downloading {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=180) as res, dest.open("wb") as fh:
        while True:
            chunk = res.read(1024 * 256)
            if not chunk:
                break
            fh.write(chunk)
    print(f"wrote {dest} ({dest.stat().st_size} bytes)", flush=True)


def emit(fh, term, kind, source, **extra) -> None:
    if not term or not isinstance(term, str):
        return
    name = term.strip()
    if len(name) < 2 or len(name) > 80:
        return
    row = {"term": name, "kind": kind, "source": source}
    row.update(extra)
    fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def listish(value):
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def extract_artists(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(
        path,
        columns=["name", "type", "aliases", "tags", "ipi_codes", "isni_codes", "country"],
    )
    count = 0
    for row in table.to_pylist():
        name = row.get("name") or ""
        typ = row.get("type") or ""
        if typ not in ("Person", "Group", "Orchestra", "Choir", "Character"):
            continue
        aliases = listish(row.get("aliases"))
        tags = listish(row.get("tags"))
        ipi = listish(row.get("ipi_codes"))
        isni = listish(row.get("isni_codes"))
        notable = bool(ipi or isni or tags)
        if not notable:
            continue
        emit(fh, name, "artist", "musicbrainz-artists")
        count += 1
        kept = 0
        for alias in aliases:
            if kept >= 2:
                break
            alias = alias.strip()
            if not (2 <= len(alias) <= 60):
                continue
            if alias.lower() == str(name).lower():
                continue
            emit(fh, alias, "artist", "musicbrainz-artists-alias")
            count += 1
            kept += 1
    return count


def extract_songs(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(path, columns=["title"])
    count = 0
    for row in table.to_pylist():
        emit(fh, row.get("title"), "work", "musicbrainz-songs")
        count += 1
    return count


def extract_tv(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(path, columns=["name", "imdb_id", "rating_average"])
    count = 0
    for row in table.to_pylist():
        name = row.get("name")
        if not name:
            continue
        if not row.get("imdb_id") and (row.get("rating_average") or 0) < 6:
            if len(str(name).split()) < 2:
                continue
        emit(fh, name, "franchise", "tvmaze-shows")
        count += 1
    return count


def extract_steam(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(path, columns=["name", "positive_reviews", "type"])
    count = 0
    for row in table.to_pylist():
        if (row.get("type") or "game") not in ("game", "Game", None):
            continue
        reviews = row.get("positive_reviews") or 0
        name = row.get("name")
        if reviews < 20 and name and len(str(name).split()) < 2:
            continue
        emit(fh, name, "franchise", "steam-games")
        count += 1
    return count


def extract_anilist(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(path, columns=["title_english", "title_romaji", "popularity"])
    count = 0
    for row in table.to_pylist():
        if (row.get("popularity") or 0) < 1000:
            continue
        emit(fh, row.get("title_english"), "franchise", "anilist")
        emit(fh, row.get("title_romaji"), "franchise", "anilist")
        count += 2
    return count


def extract_manga(path: Path, fh) -> int:
    import pyarrow.parquet as pq

    table = pq.read_table(path, columns=["title", "title_english", "members", "score"])
    count = 0
    for row in table.to_pylist():
        members = row.get("members") or 0
        score = row.get("score") or 0
        if members < 5000 and score < 7:
            continue
        emit(fh, row.get("title"), "franchise", "jikan-manga")
        emit(fh, row.get("title_english"), "franchise", "jikan-manga")
        count += 2
    return count


def fetch_wikidata(fh) -> int:
    count = 0
    ctx = ssl.create_default_context()
    for kind, query in WD_QUERIES:
        url = "https://query.wikidata.org/sparql?query=" + urllib.request.quote(query) + "&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=120) as res:
                payload = json.loads(res.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"wikidata query failed ({exc})", flush=True)
            continue
        for binding in payload.get("results", {}).get("bindings", []):
            name = binding.get("name", {}).get("value")
            emit(fh, name, kind, "wikidata")
            count += 1
    return count


def main() -> int:
    BUILD.mkdir(parents=True, exist_ok=True)
    try:
        import pyarrow.parquet  # noqa: F401
    except ImportError:
        print("Installing pyarrow…", flush=True)
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "pyarrow"])

    for spec in SOURCES.values():
        download(spec["url"], spec["path"])

    counts = {}
    with OUT.open("w", encoding="utf-8") as fh:
        counts["artists"] = extract_artists(SOURCES["mb_artists"]["path"], fh)
        counts["songs"] = extract_songs(SOURCES["mb_songs"]["path"], fh)
        counts["tv"] = extract_tv(SOURCES["tvmaze"]["path"], fh)
        counts["games"] = extract_steam(SOURCES["steam"]["path"], fh)
        counts["anime"] = extract_anilist(SOURCES["anilist"]["path"], fh)
        counts["manga"] = extract_manga(SOURCES["manga"]["path"], fh)
        counts["wikidata"] = fetch_wikidata(fh)
    print(f"wrote {OUT} {counts}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

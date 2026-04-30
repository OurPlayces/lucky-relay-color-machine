"""
Orchestrator: takes an MP3 + a metadata file, runs extract_features + derive_profile,
prints the profile JSON to stdout.

Usage: build_profile.py <mp3_path> <metadata.json>

metadata.json shape:
{
  "reader": "sid",
  "title": "Shiny Kindness",
  "artist": "Helen Sun",
  "genre_tags": ["indietronica", "trip-hop", "alt-pop"],
  "lyrics": "..."
}
"""

import json
import sys

import extract_features
import derive_profile


def main():
    if len(sys.argv) < 3:
        print("usage: build_profile.py <mp3> <metadata.json>", file=sys.stderr)
        sys.exit(1)
    mp3 = sys.argv[1]
    meta_path = sys.argv[2]

    with open(meta_path) as f:
        meta = json.load(f)

    features = extract_features.extract(mp3)
    profile = derive_profile.derive_profile(
        features=features,
        title=meta.get("title", ""),
        artist=meta.get("artist", ""),
        genre_tags=meta.get("genre_tags", []),
        lyrics=meta.get("lyrics", ""),
        reader=meta.get("reader"),
    )
    print(json.dumps(profile, indent=2))


if __name__ == "__main__":
    main()

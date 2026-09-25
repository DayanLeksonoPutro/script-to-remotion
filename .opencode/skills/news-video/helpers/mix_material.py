#!/usr/bin/env python3
"""Build a scene-aligned local material folder for the news-video skill.

Takes real media scraped from the news article (clips/images in --media-dir)
and arranges them into `local_material/<slug>/` so that scene `i` uses file
named `{i:04d}.<ext>`. The pipeline's local material mode maps the sorted
candidate list to scenes in order, so zero-padded names = exact per-scene
control. Scenes without a real asset are topped up from Pexels (when a key is
given) or by reusing the closest real asset.
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ASSET_EXTS = VIDEO_EXTS | IMAGE_EXTS


def _list_assets(media_dir: Path) -> list[Path]:
    if not media_dir.exists():
        return []
    assets = [
        p for p in media_dir.iterdir()
        if p.is_file() and p.suffix.lower() in ASSET_EXTS
    ]
    assets.sort(key=lambda p: p.name)
    return assets


def _pexels_download(api_key: str, term: str, orientation: str, dest: Path) -> bool:
    import requests

    url = "https://api.pexels.com/videos/search"
    response = requests.get(
        url,
        params={"query": term, "orientation": orientation, "per_page": 10},
        headers={"Authorization": api_key},
        timeout=30,
    )
    response.raise_for_status()
    videos = response.json().get("videos", [])
    if not videos:
        return False
    random.shuffle(videos)
    for video in videos:
        files = [
            f for f in video.get("video_files", [])
            if f.get("file_type") == "video/mp4"
            and f.get("link")
            and f.get("width") is not None
        ]
        if not files:
            continue
        files.sort(key=lambda f: (f.get("width", 0) or 0))
        chosen = next((f for f in files if (f.get("width", 0) or 0) >= 1080), files[-1])
        with requests.get(chosen["link"], stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(dest, "wb") as handle:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    if chunk:
                        handle.write(chunk)
        if dest.exists() and dest.stat().st_size > 0:
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble scene-aligned local material folder")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--terms", required=True, help='JSON array, one term per scene')
    parser.add_argument("--media-dir", default="", help="folder with scraped article media")
    parser.add_argument("--map", default="{}", help='JSON dict scene_index -> file name')
    parser.add_argument("--out", default="", help='default: local_material/<slug>')
    parser.add_argument("--pexels-key", default="", help="optional Pexels API key for top-ups")
    parser.add_argument("--aspect", default="9:16", choices=["9:16", "16:9", "1:1"])
    args = parser.parse_args()

    terms = json.loads(args.terms)
    scene_map = json.loads(args.map)
    media_dir = Path(args.media_dir) if args.media_dir else Path(f"out/{args.slug}/media")
    out_dir = Path(args.out) if args.out else Path(f"local_material/{args.slug}")
    out_dir.mkdir(parents=True, exist_ok=True)

    assets = _list_assets(media_dir)
    if assets:
        print(f"[mix] {len(assets)} real asset(s): {', '.join(a.name for a in assets)}")
    else:
        print("[mix] no real assets found")

    orientation = {"9:16": "portrait", "16:9": "landscape", "1:1": "square"}[args.aspect]
    produced = 0
    for index, term in enumerate(terms):
        dest = out_dir / f"{index:04d}{'.mp4' if index not in scene_map else ''}"
        source = None
        if str(index) in scene_map:
            source = media_dir / str(scene_map[str(index)])
        elif assets:
            source = assets[index % len(assets)]

        if source is not None and source.exists():
            dest = out_dir / f"{index:04d}{source.suffix.lower()}"
            shutil.copy2(source, dest)
            print(f"[mix] scene {index} <- {source.name} ({term})")
            produced += 1
        elif args.pexels_key:
            dest = out_dir / f"{index:04d}.mp4"
            try:
                if _pexels_download(args.pexels_key, term, orientation, dest):
                    print(f"[mix] scene {index} <- pexels '{term}'")
                    produced += 1
            except Exception as exc:  # noqa: BLE001
                print(f"[mix] pexels failed for scene {index}: {exc}")
        else:
            print(f"[mix] scene {index} has no asset (gradient fallback in Remotion)")

    if produced == 0:
        print("[mix] ERROR: no material produced; drop the folder and run with stock/default")
        return 1
    print(f"[mix] done: {produced} files in {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
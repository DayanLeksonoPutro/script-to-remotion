"""Stock material acquisition: Pexels API or a local folder.

Simplified port of MoneyPrinterTurbo's material service. Chooses one MP4 per
search term with the closest resolution above the target aspect, or cycles
local files.
"""
from __future__ import annotations

import random
from pathlib import Path
from typing import Optional

import requests

from .config import Config
from .tts import _duration_seconds

_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv"}
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _pexels_search(api_key: str, query: str, orientation: str, per_page: int = 15) -> list[dict]:
    url = "https://api.pexels.com/videos/search"
    params = {"query": query, "orientation": orientation, "per_page": per_page}
    headers = {"Authorization": api_key}
    response = requests.get(url, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json().get("videos", [])


def _pick_pexels_file(video: dict, target: tuple[int, int]) -> Optional[dict]:
    """Pick the best video file: closest width >= target width, prefer mp4."""
    files = [
        f for f in video.get("video_files", [])
        if f.get("file_type") == "video/mp4" and f.get("link")
    ]
    if not files:
        return None
    files = [
        f
        for f in files
        if f.get("width") is not None
        and f.get("height") is not None
        and f.get("width") >= target[0]
    ] or files
    # prefer the smallest file that fits; fall back to smallest overall
    return sorted(files, key=lambda f: f.get("width", 0) or 0)[0]


def _download(url: str, output_path: Path) -> bool:
    with requests.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        with open(output_path, "wb") as file:
            for chunk in response.iter_content(chunk_size=1 << 20):
                if chunk:
                    file.write(chunk)
    return output_path.exists() and output_path.stat().st_size > 0


def _local_candidates(cfg: Config) -> list[Path]:
    directory = Path(cfg.local_material_dir)
    if not directory.exists():
        return []
    files = [
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in {*_VIDEO_EXTENSIONS, *_IMAGE_EXTENSIONS}
    ]
    files.sort(key=lambda p: p.name)
    return files


def fetch_material(cfg: Config, terms: list[str], job_dir: Path, target: tuple[int, int]) -> list[Optional[Path]]:
    """Fetch one material per term. Returns list aligned with terms.

    Missing/unusable entries are None (the story builder probes duration and
    can filter them). Pexels requires an API key; local needs local_material_dir.
    """
    results: list[Optional[Path]] = []
    material_dir = job_dir / "material"
    material_dir.mkdir(parents=True, exist_ok=True)

    if cfg.material_source == "local":
        candidates = _local_candidates(cfg)
        if not candidates:
            print("[material] local_material_dir is empty or missing")
            return [None] * len(terms)
        for index, _ in enumerate(terms):
            source = candidates[index % len(candidates)]
            dest = material_dir / f"{index}{source.suffix.lower()}"
            if dest != source and not dest.exists():
                dest.write_bytes(source.read_bytes())
            elif dest != source:
                pass
            results.append(dest)
        return results

    # Pexels
    if not cfg.pexels_api_key:
        print("[material] PEXELS_API_KEY not set; no stock video downloaded")
        return [None] * len(terms)

    orientation = {"9:16": "portrait", "16:9": "landscape", "1:1": "square"}[cfg.aspect]
    for index, term in enumerate(terms):
        dest = material_dir / f"{index}.mp4"
        try:
            videos = _pexels_search(cfg.pexels_api_key, term, orientation)
            if not videos:
                print(f"[material] no result for '{term}'")
                results.append(None)
                continue
            random.shuffle(videos)
            chosen = next(
                (emit for video in videos if (emit := _pick_pexels_file(video, target))),
                None,
            )
            if chosen is None:
                results.append(None)
                continue
            if not _download(chosen["link"], dest):
                results.append(None)
                continue
            results.append(dest)
        except Exception as exc:  # noqa: BLE001
            print(f"[material] failed for '{term}': {exc}")
            results.append(None)
    return results


def material_duration(path: Path) -> float:
    if path is None:
        return 0.0
    if path.suffix.lower() in _IMAGE_EXTENSIONS:
        return 0.0  # images get a fixed scene length, not measured
    return _duration_seconds(path)
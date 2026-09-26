#!/usr/bin/env python3
"""Build `shot.json` for the screenshot-video skill.

Copies the user's screenshots into `studio/public/stories/<slug>/shot/` (Remotion
serves everything under `publicDir` via `staticFile()`), then writes the props
contract consumed by the `ShotVideo` composition in `studio/src/ShotVideo.tsx`.

Screenshots are taken in sorted filename order, so zero-padded names
(`01.png`, `02.png`, ...) give exact control over the shot order.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic"}
VIDEO_EXTS = {".mp4", ".mov", ".webm"}

PROJECT_ROOT = Path(__file__).resolve().parents[4]
PUBLIC_DIR = PROJECT_ROOT / "studio" / "public"

DEFAULT_BGM = "/songs/output007.mp3"
DEFAULT_HOOK_FONT = "BeVietnamPro-Bold.ttf"
DEFAULT_SUBTEXT_FONT = "BeVietnamPro-Medium.ttf"


def slugify(value: str) -> str:
    out = []
    for ch in value.strip().lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "screenshot-video"


def collect_images(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        if raw.is_dir():
            found = [
                p
                for p in raw.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTS | VIDEO_EXTS
            ]
            files.extend(sorted(found, key=lambda p: p.name))
        elif raw.is_file():
            files.append(raw)
        else:
            print(f"warn: tidak ditemukan, diabaikan: {raw}", file=sys.stderr)
    if not files:
        raise SystemExit("error: tidak ada screenshot yang bisa dipakai")
    return files


def find_background(src: str | None) -> str | None:
    if not src:
        return None
    candidate = PUBLIC_DIR / src.lstrip("/")
    if not candidate.exists():
        print(f"warn: background tidak ada: {candidate}", file=sys.stderr)
        return None
    return f"/{src.lstrip('/')}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build shot.json for screenshot-video")
    parser.add_argument("--slug", required=True, help="slug job, mis. 'tweet-gvk'")
    parser.add_argument(
        "--images",
        nargs="+",
        required=True,
        type=Path,
        help="file screenshot dan/atau folder berisi screenshot (urutan = nama file)",
    )
    parser.add_argument("--subject", default="", help="judul/judul-length untuk laporan")
    parser.add_argument("--duration", type=float, default=3.0, help="durasi per shot (detik)")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--hook", default="", help="teks hook di atas screenshot")
    parser.add_argument("--emphasis", default="", help="frasa yang di-highlight, dipisah koma")
    parser.add_argument("--subtext", default="", help="baris kecil di bawah hook, mis. '@user · 12.4K likes'")
    parser.add_argument("--hook-position", choices=["top", "bottom"], default="top")
    parser.add_argument("--hook-size", type=int, default=96, help="font size hook (px)")
    parser.add_argument("--hook-color", default="#FFFFFF")
    parser.add_argument("--emphasis-color", default="#FFD93D")
    parser.add_argument("--hook-font", default=DEFAULT_HOOK_FONT)
    parser.add_argument("--subtext-font", default=DEFAULT_SUBTEXT_FONT)
    parser.add_argument("--hook-animate", choices=["fade", "pop"], default="pop")
    parser.add_argument("--captions", default="", help="caption per shot, dipisah '|'")
    parser.add_argument("--zoom", type=float, default=1.04, help="zoom akhir shot (1 = diam)")
    parser.add_argument(
        "--bg",
        choices=["solid", "image", "video"],
        default="solid",
        help="tipe background",
    )
    parser.add_argument(
        "--bg-src",
        default="",
        help="path backdrop di studio/public, mis. '/backgrounds/dust.jpg' (wajib kalau bukan solid)",
    )
    parser.add_argument("--bg-color", default="#0B0B0F")
    parser.add_argument("--bg-blur", type=float, default=0.0)
    parser.add_argument("--bg-dim", type=float, default=0.45, help="scrim hitam 0-1")
    parser.add_argument("--bg-fit", choices=["cover", "contain"], default="cover")
    parser.add_argument("--bgm", default=DEFAULT_BGM, help="path BGM di studio/public; '' = tanpa musik")
    parser.add_argument("--bgm-volume", type=float, default=0.18)
    args = parser.parse_args()

    slug = slugify(args.slug)
    job_dir = PUBLIC_DIR / "stories" / slug
    shot_dir = job_dir / "shot"
    shot_dir.mkdir(parents=True, exist_ok=True)

    sources = collect_images(args.images)
    captions = [c.strip() for c in args.captions.split("|")] if args.captions.strip() else []

    shots = []
    cursor = 0.0
    for index, source in enumerate(sources):
        ext = source.suffix.lower()
        if ext == ".heic":
            ext = ".jpg"
        dest_name = f"{index + 1:02d}{ext}"
        dest = shot_dir / dest_name
        if source.resolve() != dest.resolve():
            shutil.copy2(source, dest)
        duration = args.duration
        shots.append(
            {
                "index": index,
                "image": f"/stories/{slug}/shot/{dest_name}",
                "start": round(cursor, 3),
                "end": round(cursor + duration, 3),
                "zoom": args.zoom,
                "caption": captions[index] if index < len(captions) else "",
            }
        )
        cursor += duration

    bg_src = find_background(args.bg_src)
    if args.bg != "solid" and not bg_src:
        print("warn: --bg bukan solid tapi --bg-src kosong/tidak ada → turun ke solid", file=sys.stderr)
        args.bg = "solid"

    story = {
        "version": 1,
        "subject": args.subject or slug,
        "fps": args.fps,
        "width": 1080,
        "height": 1920,
        "bgm": args.bgm or None,
        "bgm_volume": args.bgm_volume,
        "background": {
            "type": args.bg,
            "src": bg_src,
            "color": args.bg_color,
            "blur": args.bg_blur,
            "dim": args.bg_dim,
            "fit": args.bg_fit,
        },
        "hook": {
            "enabled": bool(args.hook.strip()),
            "text": args.hook.strip(),
            "emphasis": [e.strip() for e in args.emphasis.split(",") if e.strip()],
            "subtext": args.subtext.strip(),
            "position": args.hook_position,
            "font_size_px": args.hook_size,
            "color": args.hook_color,
            "emphasis_color": args.emphasis_color,
            "font_name": args.hook_font,
            "subtext_font_name": args.subtext_font,
            "animate": args.hook_animate,
        },
        "shots": shots,
    }

    out_file = job_dir / "shot.json"
    out_file.write_text(json.dumps(story, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"shot.json: {out_file}")
    print(f"slug: {slug} | shots: {len(shots)} | durasi: {cursor:.2f}s | background: {args.bg}")
    for shot in shots:
        print(f"  shot {shot['index']}: {shot['image']} [{shot['start']}-{shot['end']}s]")
    if args.hook:
        print(f"hook: {args.hook}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

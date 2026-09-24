"""Build the final story.json consumed by the Remotion studio.

story.json is the single contract between the Python pipeline and the React
renderer, so the two sides stay loosely coupled (mirrors MoneyPrinterTurbo's
script.json manifest approach).
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from .config import Config
from .material import material_duration
from .tts import WordCue


def _sentence_captions(script_sentence: str, duration: float) -> list[dict]:
    """Fallback caption group when TTS gave no word cues."""
    return [{"text": script_sentence, "start": 0.0, "end": duration}]


def build_story(
    cfg: Config,
    *,
    subject: str,
    script_paragraphs: list[str],
    terms: list[str],
    audio_files: list[Path],
    audio_durations: list[float],
    caption_groups: list[Optional[list[WordCue]]],
    material_files: list[Optional[Path]],
    job_dir: Path,
    story_url_base: str,
) -> dict:
    """Assemble scenes with a sequential timeline. Returns story dict."""
    scenes: list[dict] = []
    cursor = 0.0
    available_terms = [term for term in terms if term]

    for index, narration in enumerate(script_paragraphs):
        audio_duration = audio_durations[index] if index < len(audio_durations) else 0.0
        scene_duration = max(audio_duration, 1.0) + cfg.scene_padding

        material = material_files[index] if index < len(material_files) else None
        material_blob: Optional[dict] = None
        if material is not None:
            file_duration = material_duration(material)
            start_from = 0.0
            if file_duration > scene_duration:
                start_from = round(float(file_duration - scene_duration) * random(), 2)
            material_blob = {
                "url": f"{story_url_base}/material/{material.name}",
                "duration": round(file_duration, 2),
                "start_from": start_from,
            }

        cues = caption_groups[index] if index < len(caption_groups) else None
        if not cues:
            cues = [
                WordCue(text=narration.strip(), start=0.0, end=audio_duration or max(scene_duration, 0.5))
            ]
        captions = [
            {"text": cue.text, "start": round(cue.start, 3), "end": round(cue.end, 3)}
            for cue in cues
            if cue.text
        ]

        scenes.append(
            {
                "index": index,
                "narration": narration.strip(),
                "audio": f"{story_url_base}/audio/{index}.mp3",
                "audio_start": round(cursor, 3),
                "audio_duration": round(audio_duration, 3),
                "start": round(cursor, 3),
                "end": round(cursor + scene_duration, 3),
                "video": material_blob,
                "keyword": available_terms[index] if index < len(available_terms) else "",
                "captions": captions,
            }
        )
        cursor += scene_duration

    last_scene = scenes[-1] if scenes else None
    if last_scene:
        last_scene["end"] += 1.2  # breathing room at the very end

    bgm_url = None
    if cfg.bgm:
        bgm_abs = Path(cfg.bgm)
        if bgm_abs.exists():
            dest = job_dir / "bgm"
            dest.mkdir(parents=True, exist_ok=True)
            bgm_path = dest / bgm_abs.name
            if bgm_path != bgm_abs and not bgm_path.exists():
                bgm_path.write_bytes(bgm_abs.read_bytes())
            bgm_url = f"{story_url_base}/bgm/{bgm_path.name}"

    story = {
        "version": 1,
        "subject": subject,
        "fps": cfg.fps,
        "width": cfg.width,
        "height": cfg.height,
        "duration": round(cursor + (1.2 if scenes else 0), 3),
        "bgm": bgm_url,
        "bgm_volume": cfg.bgm_volume,
        "captions": cfg.captions,
        "scenes": scenes,
    }
    return story


def random() -> float:
    import random

    return random.random()


def write_story(job_dir: Path, story: dict) -> Path:
    story_path = job_dir / "story.json"
    story_path.write_text(json.dumps(story, ensure_ascii=False, indent=2), encoding="utf-8")
    return story_path
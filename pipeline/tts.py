"""Edge TTS synthesis with word-level timing (SubMaker cues).

Port of the proven pattern from MoneyPrinterTurbo: feed WordBoundary events
into edge_tts.SubMaker and read `cues` for per-word start/end. The narration
timeline uses the real file duration (ffprobe), not the last cue end, because
EDGE TTS leaves a variable tail past the last word boundary.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

import edge_tts
from edge_tts import SubMaker

from .config import Config


@dataclass(frozen=True)
class WordCue:
    text: str
    start: float  # seconds, relative to the audio start
    end: float


def _duration_seconds(path: Path) -> float:
    """Probe media duration via ffprobe; 0.0 if anything fails."""
    import subprocess

    try:
        completed = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return float(completed.stdout.strip() or 0)
    except (subprocess.SubprocessError, ValueError, OSError):
        return 0.0


async def _synthesize(
    text: str, voice: str, rate: int, output_path: Path
) -> Optional[SubMaker]:
    rate_str = "+" if rate >= 0 else ""
    communicate = edge_tts.Communicate(text, voice, rate=f"{rate_str}{rate}%")
    sub_maker = SubMaker()
    with open(output_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            chunk_type = chunk.get("type")
            if chunk_type in ("WordBoundary", "SentenceBoundary"):
                sub_maker.feed(chunk)
            elif chunk_type == "audio":
                audio_file.write(chunk["data"])
    return sub_maker if sub_maker.get_srt() else None


def synthesize(
    cfg: Config, text: str, output_path: Path
) -> tuple[Optional[list[WordCue]], float]:
    """Synthesize narration for one text block.

    Returns (captions, duration_seconds). captions is None when no cues were
    produced (the audio file is still written and usable).
    """
    text = text.strip()
    if not text:
        return None, 0.0

    try:
        sub_maker = asyncio.run(_synthesize(text, cfg.voice, cfg.voice_rate, output_path))
    except Exception as exc:  # noqa: BLE001
        print(f"[tts] synthesis failed: {exc}")
        return None, 0.0

    if output_path.exists() and output_path.stat().st_size == 0:
        output_path.unlink(missing_ok=True)
        return None, 0.0

    cues: Optional[list[WordCue]] = None
    if sub_maker is not None:
        cues = [
            WordCue(
                text=cue.content.strip(),
                start=cue.start.total_seconds(),
                end=cue.end.total_seconds(),
            )
            for cue in sub_maker.cues
            if cue.content.strip()
        ]

    duration = _duration_seconds(output_path)
    return cues, duration
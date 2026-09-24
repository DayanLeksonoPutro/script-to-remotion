#!/usr/bin/env python3
"""script-to-remotion pipeline CLI.

Usage:
    python -m pipeline.main "Topik video" [--script "par1.\n\npar2."]
    python -m pipeline.main "Topik" --no-voice   # generate materials + story only

The pipeline produces `studio/public/stories/<slug>/story.json` which the
Remotion studio renders.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pipeline import llm, material, story, tts  # noqa: E402
from pipeline.config import Config  # noqa: E402


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "video"


def _split_script(script: str) -> list[str]:
    return [p.strip() for p in script.split("\n\n") if p.strip()]


def _prune_job_dir(job_dir: Path) -> None:
    """Reset a previous run but keep files produced by the opencode skill
    (script.txt, terms.json) so the pipeline can consume them."""
    if not job_dir.exists():
        return
    for entry in job_dir.iterdir():
        if entry.name in {"script.txt", "terms.json"}:
            continue
        if entry.is_dir():
            shutil.rmtree(entry)
        else:
            entry.unlink(missing_ok=False)


def run(subject: str, custom_script: str = "", no_voice: bool = False) -> dict:
    cfg = Config.load()
    slug = _slugify(subject)
    job_dir = PROJECT_ROOT / "studio" / "public" / "stories" / slug
    _prune_job_dir(job_dir)
    (job_dir / "audio").mkdir(parents=True)
    url_base = f"/stories/{slug}"

    print(f"\n== subject: {subject}")
    print(f"== job dir: {job_dir}\n")

    # 1. script: --script > script.txt (skill/opencode output) > LLM
    paragraphs: list[str] = []
    source = ""
    if custom_script.strip():
        paragraphs = _split_script(custom_script)
        source = "--script"
    else:
        skill_script = job_dir / "script.txt"
        if skill_script.exists():
            paragraphs = _split_script(skill_script.read_text(encoding="utf-8"))
            source = "script.txt (opencode skill)"
        else:
            cfg.require_llm()
            generated = llm.generate_script(cfg, subject, paragraph_number=5, language="")
            if not generated:
                raise RuntimeError("failed to generate script (check LLM config)")
            paragraphs = _split_script(generated)
            source = "LLM"
    print(f"== script ({len(paragraphs)} paragraph/scene) <- {source}\n")
    for paragraph in paragraphs:
        print(f"   - {paragraph[:60]}...")

    # 2. search terms (one per scene, in narration order)
    #    terms.json (skill/opencode output) > LLM > subject fallback
    terms: list[str] = []
    terms_source = ""
    term_file = job_dir / "terms.json"
    if term_file.exists():
        try:
            terms = json.loads(term_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"invalid terms.json from skill: {exc}") from exc
        if isinstance(terms, list) and all(isinstance(t, str) for t in terms):
            terms_source = "terms.json (opencode skill)"
    if not terms and cfg.llm.api_key:
        generated_terms = llm.generate_terms(
            cfg, subject, "\n\n".join(paragraphs), amount=len(paragraphs),
            match_script_order=True,
        )
        if generated_terms:
            terms = generated_terms
            terms_source = "LLM"
    if not terms:
        terms_source = "subject words"
        terms = [subject] * len(paragraphs)
        print("\n== terms: no source, falling back to subject words")
    else:
        print(f"\n== terms: {terms} <- {terms_source}")

    # 3. voice + captions
    audio_files: list[Path] = []
    audio_durations: list[float] = []
    caption_groups: list = []
    if no_voice:
        audio_files = [Path()] * len(paragraphs)
        audio_durations = [len(p) / 12.0 for p in paragraphs]  # naive estimate
        caption_groups = [None] * len(paragraphs)
    else:
        for index, paragraph in enumerate(paragraphs):
            audio_path = job_dir / "audio" / f"{index}.mp3"
            print(f"\n== tts scene {index}: {audio_path.name}")
            cues, duration = tts.synthesize(cfg, paragraph, audio_path)
            if duration <= 0:
                raise RuntimeError(f"TTS produced no audio for scene {index}")
            audio_files.append(audio_path)
            audio_durations.append(duration)
            caption_groups.append(cues)
            print(f"   -> {duration:.2f}s, {len(cues) if cues else 0} cues")

    # 4. materials
    target = (cfg.width, cfg.height)
    material_files = material.fetch_material(cfg, terms, job_dir, target)
    missing = sum(1 for path in material_files if path is None)
    print(f"\n== materials fetched: {len(material_files) - missing}/{len(material_files)}")

    # 5. story.json
    story_dict = story.build_story(
        cfg,
        subject=subject,
        script_paragraphs=paragraphs,
        terms=terms,
        audio_files=audio_files,
        audio_durations=audio_durations,
        caption_groups=caption_groups,
        material_files=material_files,
        job_dir=job_dir,
        story_url_base=url_base,
    )
    story_path = story.write_story(job_dir, story_dict)
    print(f"\n== story written: {story_path}")
    print(f"   duration: {story_dict['duration']:.1f}s over {len(story_dict['scenes'])} scenes")
    return story_dict


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a Remotion video story.")
    parser.add_argument("subject", help="video topic / keyword")
    parser.add_argument("--script", default="", help="custom script, paragraphs split by blank lines")
    parser.add_argument("--no-voice", action="store_true", help="skip TTS (dummy pacing)")
    args = parser.parse_args()
    run(args.subject, custom_script=args.script, no_voice=args.no_voice)


if __name__ == "__main__":
    main()
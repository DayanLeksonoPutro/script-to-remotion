"""LLM helpers: video script + stock search terms generation.

Port of the proven prompt/parsing patterns from MoneyPrinterTurbo
(app/services/llm.py), simplified with graceful fallbacks.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from openai import OpenAI

from .config import Config, DEFAULT_BASE_URL, DEFAULT_MODEL

_MAX_RETRIES = 3

_THINK_BLOCK_RE = re.compile(r"<think\b[^>]*>.*?</think>", re.IGNORECASE | re.DOTALL)
_UNCLOSED_THINK_RE = re.compile(r"<think\b[^>]*>.*$", re.IGNORECASE | re.DOTALL)
_FENCE_RE = re.compile(r"^```[a-zA-Z0-9]*\s*|\s*```$")

DEFAULT_SCRIPT_SYSTEM_PROMPT = """
# Role: Video Script Generator

## Goals:
Generate a script for a video, depending on the subject of the video.

## Constrains:
1. the script is to be returned as a string with the specified number of paragraphs.
2. do not under any circumstance reference this prompt in your response.
3. get straight to the point, don't start with unnecessary things like, "welcome to this video".
4. you must not include any type of markdown or formatting in the script, never use a title.
5. only return the raw content of the script.
6. do not include "voiceover", "narrator" or similar indicators of what should be spoken at the beginning of each paragraph or line.
7. you must not mention the prompt, or anything about the script itself. also, never talk about the amount of paragraphs or lines. just write the script.
8. respond in the same language as the video subject.
""".strip()


def _client(cfg: Config) -> OpenAI:
    base_url = (cfg.llm.base_url or DEFAULT_BASE_URL).strip()
    return OpenAI(api_key=cfg.llm.api_key, base_url=base_url)


def _model_name(cfg: Config) -> str:
    return cfg.llm.model.strip() or DEFAULT_MODEL


def _normalize_text(content: object) -> Optional[str]:
    if content is None:
        return None
    if not isinstance(content, str):
        return None
    text = _THINK_BLOCK_RE.sub("", content)
    text = _UNCLOSED_THINK_RE.sub("", text).strip()
    return text or None


def _chat(cfg: Config, system_prompt: str, prompt: str) -> Optional[str]:
    for attempt in range(_MAX_RETRIES):
        try:
            response = _client(cfg).chat.completions.create(
                model=_model_name(cfg),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            text = _normalize_text(response.choices[0].message.content)
            if text:
                return text
        except Exception as exc:  # noqa: BLE001 - caller decides on fallback
            print(f"[llm] attempt {attempt + 1}/{_MAX_RETRIES} failed: {exc}")
    return None


def build_script_prompt(
    video_subject: str, paragraph_number: int = 1, language: str = "", extra: str = ""
) -> str:
    prompt = DEFAULT_SCRIPT_SYSTEM_PROMPT
    prompt += f"""

# Initialization:
- video subject: {video_subject}
- number of paragraphs: {paragraph_number}
""".rstrip()
    if language:
        prompt += f"\n- language: {language}"
    if extra:
        prompt += f"\n\n# Additional User Requirements:\n{extra}"
    return prompt


def generate_script(
    cfg: Config,
    video_subject: str,
    paragraph_number: int = 1,
    language: str = "",
    extra: str = "",
) -> Optional[str]:
    """Return paragraphs separated by blank lines, or None on failure."""
    prompt = build_script_prompt(video_subject, paragraph_number, language, extra)
    response = _chat(cfg, "You are a concise video script copywriter.", prompt)
    if not response:
        return None
    text = response.replace("*", "").replace("#", "")
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\(.*?\)", "", text)
    return "\n\n".join(part.strip() for part in text.split("\n\n") if part.strip())


def generate_terms(
    cfg: Config,
    video_subject: str,
    video_script: str,
    amount: int = 5,
    match_script_order: bool = False,
) -> list[str]:
    """Generate English stock-video search terms. Falls back to [] on failure.

    When match_script_order=True the terms follow the narration order so each
    scene gets a keyword that describes its own visual moment.
    """
    if match_script_order:
        goal = (
            f"Generate {amount} chronological stock-video search terms that follow "
            "the order of topics in the video script."
        )
        ordering_rule = (
            "6. keep the terms in the same order as the script narration; "
            "earlier terms must describe earlier visual moments."
        )
        examples = ["opening visual topic"]
        examples += [f"script visual topic {i}" for i in range(2, max(amount, 1))]
        output_example = json.dumps(examples[:amount], ensure_ascii=False)
    else:
        goal = (
            f"Generate {amount} search terms for stock videos, depending on the "
            "subject of a video."
        )
        ordering_rule = ""
        output_example = '["search term 1", "search term 2", "search term 3", "search term 4", "search term 5"]'

    prompt = f"""
# Role: Video Search Terms Generator

## Goals:
{goal}

## Constrains:
1. the search terms are to be returned as a json-array of strings.
2. each search term should consist of 1-3 words, always add the main subject of the video.
3. you must only return the json-array of strings. you must not return anything else. you must not return the script.
4. the search terms must be related to the subject of the video.
5. reply with english search terms only.
{ordering_rule}

## Output Example:
{output_example}

## Context:
### Video Subject
{video_subject}

### Video Script
{video_script}

Please note that you must use English for generating video search terms; Chinese is not accepted.
""".strip()

    response = _chat(cfg, "You output valid JSON arrays only.", prompt)
    if not response:
        return []

    candidates: object | None = None
    try:
        candidates = json.loads(_FENCE_RE.sub("", response.strip()))
    except json.JSONDecodeError:
        match = re.search(r"\[.*]", response, re.DOTALL)
        if match:
            try:
                candidates = json.loads(match.group())
            except json.JSONDecodeError:
                candidates = None

    if not isinstance(candidates, list) or not all(
        isinstance(item, str) and item.strip() for item in candidates
    ):
        return []
    return [item.strip() for item in candidates][:amount]
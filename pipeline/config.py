"""Configuration for the script-to-remotion pipeline.

Config priority: environment variables > config.json in project root.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"


@dataclass
class LLMConfig:
    provider: str = "openai_compatible"
    base_url: str = ""
    api_key: str = ""
    model: str = ""


@dataclass
class Config:
    llm: LLMConfig = field(default_factory=LLMConfig)
    material_source: str = "pexels"  # pexels | local
    local_material_dir: str = ""
    pexels_api_key: str = ""
    voice: str = "id-ID-ArdiNeural"
    voice_rate: int = 0  # percent
    aspect: str = "9:16"  # 9:16 | 16:9 | 1:1
    fps: int = 30
    bgm: str = ""  # path to BGM file, empty = none
    bgm_volume: float = 0.2
    scene_padding: float = 0.8  # seconds added after narration to each scene
    captions: dict = field(
        default_factory=lambda: {
            "enabled": True,
            "mode": "word",  # word | sentence
            "position": "bottom",  # bottom | top | center
            "font_size_px": 88,
            "text_color": "#FFFFFF",
            "active_color": "#FFD93D",
            "dim_color": "#FFFFFF",
        }
    )

    @staticmethod
    def load(path: str | os.PathLike | None = None) -> "Config":
        config_path = Path(path) if path else PROJECT_ROOT / "config.json"
        raw: dict = {}
        if config_path.exists():
            raw = json.loads(config_path.read_text(encoding="utf-8"))

        llm_raw = raw.get("llm", {})
        llm = LLMConfig(
            provider=os.getenv("LLM_PROVIDER", llm_raw.get("provider", "openai_compatible")),
            base_url=os.getenv("LLM_BASE_URL", llm_raw.get("base_url", "")),
            api_key=os.getenv("LLM_API_KEY", llm_raw.get("api_key", "")),
            model=os.getenv("LLM_MODEL", llm_raw.get("model", "")),
        )

        cfg = Config(
            llm=llm,
            material_source=os.getenv("MATERIAL_SOURCE", raw.get("material_source", "pexels")),
            local_material_dir=os.getenv(
                "LOCAL_MATERIAL_DIR", raw.get("local_material_dir", "")
            ),
            pexels_api_key=os.getenv("PEXELS_API_KEY", raw.get("pexels_api_key", "")),
            voice=os.getenv("TTS_VOICE", raw.get("voice", "id-ID-ArdiNeural")),
            voice_rate=int(os.getenv("TTS_VOICE_RATE", raw.get("voice_rate", 0))),
            aspect=os.getenv("ASPECT", raw.get("aspect", "9:16")),
            fps=int(os.getenv("FPS", raw.get("fps", 30))),
            bgm=os.getenv("BGM", raw.get("bgm", "")),
            bgm_volume=float(os.getenv("BGM_VOLUME", raw.get("bgm_volume", 0.2))),
            scene_padding=float(os.getenv("SCENE_PADDING", raw.get("scene_padding", 0.8))),
            captions={**Config.capture_defaults(), **raw.get("captions", {})},
        )
        return cfg

    @staticmethod
    def capture_defaults() -> dict:
        return Config().captions

    @property
    def width(self) -> int:
        return {  # type: ignore[return-value]
            "9:16": 1080,
            "16:9": 1920,
            "1:1": 1080,
        }[self.aspect]

    @property
    def height(self) -> int:
        return {
            "9:16": 1920,
            "16:9": 1080,
            "1:1": 1080,
        }[self.aspect]

    def require_llm(self) -> None:
        if not self.llm.api_key:
            raise RuntimeError(
                "LLM not configured. Set LLM_API_KEY (or install Ollama and set "
                "LLM_BASE_URL=http://localhost:11434/v1 LLM_API_KEY=ollama). "
                "Without LLM you must pass --script explicitly."
            )
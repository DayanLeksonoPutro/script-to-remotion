# Script to Remotion 🎬

> Semi-manual short video generator: **LLM/skill script → synced TTS captions → Remotion render**

[![License](https://img.shields.io/github/license/dayanleksonoputro/script-to-remotion?color=blue&label=License)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Remotion](https://img.shields.io/badge/remotion-4.x-black?logo=react&logoColor=white)](https://remotion.dev)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/dayanleksonoputro/script-to-remotion)

Generator video pendek **semi-manual** berbasis [Remotion](https://remotion.dev).
Terinspirasi dari [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)
(MIT), tapi pola pipeline-nya di-port ulang dengan **Remotion sebagai satu-satunya
renderer** sehingga hasil bisa di-preview dan di-tweak langsung di *Remotion Studio*.

Prinsip: `story.json` adalah *kontrak tunggal* antara pipeline dan renderer.

```
script-to-remotion/
├── pipeline/        # Python: script → TTS word-timing → material → story.json
│   ├── config.py    #   config.json / env (LLM, Pexels, TTS, aspek, BGM)
│   ├── llm.py       #   generate_script + generate_terms (port prompt MPT)
│   ├── tts.py       #   Edge TTS + word-boundary cue (SubMaker)
│   ├── material.py  #   Pexels / folder lokal, pilih video sesuai aspek
│   ├── story.py     #   builder story.json (timeline per scene)
│   └── main.py      #   CLI entry point
├── studio/          # project Remotion (React/TS)
│   └── src/
│       ├── Root.tsx        # registrasi Composition, baca story.json
│       ├── Story.tsx       # template: scene + video + audio + BGM
│       └── WordCaptions.tsx# karaoke-style caption per kata
├── scripts/
│   ├── render.mjs          # render video final (headless)
│   └── open.mjs            # buka Remotion Studio untuk preview/edit
└── out/                    # hasil render
```

## Fitur MVP

- Skrip & search-term otomatis dari topik (LLM, provider-agnostic, `match_script_order`)
- Voiceover per scene via **Edge TTS** (gratis, tanpa API key) **dengan timing per kata**
- Material dari **Pexels API** (gratis) atau folder lokal
- **Semi-manual**: edit `story.json` / komponen React / prop apapun di Remotion Studio, lalu render
- Caption karaoke per kata + konfigurasi style
- BGM opsional (file lokal), volume terpisah
- Fallback rapi tanpa LLM/Pexels (script manual `--script`, keyword dari topik)

## Requirement

- Python ≥ 3.11
- Node ≥ 18 + npm
- ffmpeg / ffprobe (path `ffmpeg` / `ffprobe` di `PATH`)

## Setup

```bash
cd script-to-remotion

# 1. Python pipeline
python3 -m venv .venv
.venv/bin/pip install -r pipeline/requirements.txt

# 2. Remotion studio
cd studio
npm install
cd ..
```

Konfigurasi: isi `config.json` atau env (lihat tabel di bawah).

## Membuat video

### 0. Generate script & terms via opencode (skill) — opsional

Skill [`short-video-script`](.opencode/skills/short-video-script/SKILL.md)
membuat opencode bertindak sebagai modul *scriptwriter*: menulis narasi + search
terms (urutan sesuai narasi) lalu menyimpannya ke folder story sebagai
`script.txt` dan `terms.json`.

```bash
# di dalam project ini, lalu restart opencode (skill dimuat saat start)
opencode
# > buatkan video tentang "Transformasi Energi"
```

Pipeline Python otomatis memakai kedua file itu (daftar prioritas:
`script.txt`/`terms.json` → LLM API → fallback topik), jadi alurnya:
**opencode (kreatif) → pipeline (TTS/material) → Remotion (render)**.

### 1. Generate story (pipeline)

```bash
# dengan LLM + Pexels
LLM_API_KEY=sk-... PEXELS_API_KEY=... .venv/bin/python -m pipeline.main "Topik video anda"

# tanpa LLM/Pexels (offline test)
.venv/bin/python -m pipeline.main "Topik" --script "Paragraf satu.\n\nParagraf dua."

# tanpa voiceover (uji render cepat)
.venv/bin/python -m pipeline.main "Topik" --script "..." --no-voice
```

Output: `studio/public/stories/<slug>/story.json` + asset audio/material.

### 2. Preview & edit (semi-manual)

```bash
cd studio
npx remotion studio --props=./public/stories/<slug>/story.json
```

Ubah apa saja di browser (posisi, warna, font), atau edit langsung
`src/Story.tsx` / `story.json`.

### 3. Render final

```
cd studio && node ../scripts/render.mjs "<slug>"
```

Hasil: `out/<slug>/final.mp4`.

## Konfigurasi

| Key (env / config.json)      | Default                  | Keterangan |
|------------------------------|--------------------------|------------|
| `LLM_API_KEY` / `llm.api_key`| —                        | OpenAI-compatible key |
| `LLM_BASE_URL` / `llm.base_url` | `https://api.openai.com/v1` | Ollama: `http://localhost:11434/v1`, key `ollama` |
| `LLM_MODEL` / `llm.model`    | `gpt-4o-mini`            | |
| `PEXELS_API_KEY` / `pexels_api_key` | —               | https://www.pexels.com/api/ |
| `MATERIAL_SOURCE` / `material_source` | `pexels`        | `pexels` \| `local` |
| `LOCAL_MATERIAL_DIR` / `local_material_dir` | —       | folder berisi mp4/jpg |
| `TTS_VOICE` / `voice`        | `id-ID-ArdiNeural`       | lihat `edge-tts --list-voices` |
| `TTS_VOICE_RATE` / `voice_rate` | 0                    | persen |
| `ASPECT` / `aspect`          | `9:16`                   | `9:16` \| `16:9` \| `1:1` |
| `BGM` / `bgm`                | —                        | path file audio BGM |
| `BGM_VOLUME` / `bgm_volume`  | 0.2                      | 0–1 |
| `captions.*`                 | (lihat `pipeline/config.py`) | posisi, ukuran, warna, mode, `font_name` (file di `studio/public/fonts/`, default `UTM Kabel KT.ttf`) |

## kontrak `story.json`

`story.json` mendeskripsikan seluruh video: `fps`, `width/height`, `duration`,
`bgm`, `captions` dan `scenes[]`. Tiap scene punya:

- `narration`, `audio`, `audio_start`, `audio_duration`
- `start`, `end` (timeline detik)
- `video.url`, `video.start_from` (offset mulai pemutaran material)
- `captions[]`: `{text, start, end}` per kata, relatif ke awal audio scene

Model alur:

```
subject ──▶ script (skill opencode / LLM / manual) ──▶ terms berurutan
              │                                            │
              ▼                                            ▼
        TTS + word cues                            material (Pexels / local)
              └──────────────┬─────────────┘
                             ▼
                      story.json ──▶ Remotion Studio (edit) ──▶ render MP4
```

## Roadmap

- [x] Pipeline script + terms + TTS timing + material + story.json
- [x] Remotion template: scene, caption karaoke, BGM, fade
- [x] Render CLI + studio preview
- [ ] Transisi antar scene (cross-fade/wipe) via `@remotion/transitions`
- [ ] Slicing material dengan ffmpeg agar scene selalu terisi
- [ ] Whisper fallback untuk audio custom (tanpa timing TTS)
- [ ] Metadata sosial (title/caption/hashtags per platform, port dari MPT)
- [ ] Auto-upload TikTok/IG/YT Shorts

## Lisensi

MIT. Pola dan prompt diambil/adaptasi dari
[MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT).
Remotion: gratis untuk individu/perusahaan kecil — cek [lisensi Remotion](https://remotion.dev/docs/license).
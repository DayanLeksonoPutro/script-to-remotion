# AGENTS.md

Panduan kerja untuk agent AI (opencode/Claude/Cursor) di repositori
**MoneyPrinterTurboRemotion** — generator video pendek semi-manual berbasis
Remotion (port pola MoneyPrinterTurbo, MIT).

## Alur inti

```
topik → script (skill opencode) → script.txt + terms.json
                                  ↓
                      pipeline Python (TTS word-timing + material)
                                  ↓
                          story.json (KONTRAK TUNGGAL)
                                  ↓
              Remotion Studio (edit/preview) → render MP4 (out/<slug>/final.mp4)
```

`studio/public/stories/<slug>/story.json` adalah satu-satunya kontrak antara
pipeline dan renderer. Jangan menambahkan aliran data paralel.

## Struktur repo

```
├── AGENTS.md                 # file ini
├── config.json               # konfigurasi pipeline (env > config.json)
├── pipeline/                 # Python 3.11+
│   ├── config.py             #   Config.load(): env > config.json
│   ├── llm.py                #   generate_script + generate_terms (OpenAI-compatible)
│   ├── tts.py                #   Edge TTS + word-boundary cue (SubMaker)
│   ├── material.py           #   Pexels / folder lokal, pilih sesuai aspek
│   ├── story.py              #   builder story.json (timeline per scene, BGM)
│   ├── main.py               #   CLI entry: python -m pipeline.main "Topik"
│   └── requirements.txt      #   edge-tts, openai, requests
├── studio/                   # project Remotion (React/TS, remotion 4.x)
│   ├── remotion.config.ts    #   set output/jpeg, Chrome executable
│   ├── src/
│   │   ├── index.ts          #   registerRoot
│   │   ├── Root.tsx          #   Composition "Story", baca --props story.json
│   │   ├── Story.tsx         #   template: scene + video + WordCaptions + BGM
│   │   └── types.ts          #   tipe Story/Scene/CaptionConfig
│   └── public/               #   publicDir Remotion — ASET
│       ├── fonts/            #   font untuk caption (lihat katalog di bawah)
│       ├── songs/            #   BGM (lihat katalog di bawah)
│       └── stories/<slug>/   #   hasil pipeline: script.txt, terms.json,
│                             #   audio/, material/, bgm/, story.json
├── scripts/
│   ├── render.mjs            #   node scripts/render.mjs <slug> → out/<slug>/final.mp4
│   └── open.mjs              #   buka Remotion Studio preview
├── local_material/<x>/       #   sumber material lokal (config local_material_dir)
├── out/<slug>/               #   hasil render / kerja skill youtube-video
├── testdata/                 #   contoh material lama
└── .opencode/skills/         #   skill opencode (lihat "Skills")
```

## Skills opencode (.opencode/skills/)

Dinyalakan otomatis saat opencode start. Kerjakan via mereka, jangan duplikasi.

| Skill | Folder | Keluaran |
|---|---|---|
| `short-video-script` | `.opencode/skills/short-video-script/` | `studio/public/stories/<slug>/script.txt` + `terms.json` (narasi + search term berurutan) |
| `youtube-video` | `.opencode/skills/youtube-video/` | Re-edit video YouTube → hook/cerita bahasa Indonesia, `out/<slug>/final.mp4` via ffmpeg |

## Katalog aset — `studio/public/`

Semua aset di sini diserve Remotion lewat `staticFile()`. `publicDir` =
`studio/public`, jadi path di story.json dievaluasi relatif ke situ
(contoh: `staticFile("/stories/coal-energy/material/0.mp4")`).

### Font (`studio/public/fonts/`)

Caption memakai font dari folder ini. Pilih lewat `captions.font_name` di
`config.json` (default: `UTM Kabel KT.ttf`), didaftarkan otomatis oleh
`studio/src/fonts.ts` (`staticFile()` + `FontFace`) dan dipakai di
`WordCaptions`. Penamaan family/berat ada di `FONT_MAP` `fonts.ts`. CJK pakai
YaHei/Heiti; Latin pakai Be Vietnam Pro / Charm / UTM Kabel.

| File | Family | Berat | Pakai untuk |
|---|---|---|---|
| `BeVietnamPro-Bold.ttf` | Be Vietnam Pro | 700 | Judul angka/highlight, Latin |
| `BeVietnamPro-Medium.ttf` | Be Vietnam Pro | 500 | Body caption Latin |
| `Charm-Bold.ttf` | Charm | 700 | Judul dekoratif |
| `Charm-Regular.ttf` | Charm | 400 | Teks dekoratif |
| `MicrosoftYaHeiBold.ttc` | Microsoft YaHei | 700 | CJK bold (2,5–2,8 MB) |
| `MicrosoftYaHeiNormal.ttc` | Microsoft YaHei | 400 | CJK body |
| `STHeitiLight.ttc` | Heiti SC/TC | 300 | CJK light (50+ MB) |
| `STHeitiMedium.ttc` | Heiti SC/TC | 500 | CJK medium (50+ MB) |
| `UTM Kabel KT.ttf` | UTM Kabel KT | 400 | Aksen VN/Latin (default) |

Catatan: file `.ttc` besar (YaHei ~17–20 MB, Heiti ~55 MB) — untuk render
tetap OK karena diserve dari disk.

### BGM (`studio/public/songs/`)

29 file MP3: `output000.mp3` … `output029.mp3` (**`output026.mp3` tidak ada**).
Semua ~180 detik (3:00) kecuali `output029.mp3` = 134 s. Diputar loop dengan
`volume = bgm_volume` di `Story.tsx`.

Cara pakai lewat pipeline (bukan edit story.json manual):
1. Set `bgm` di `config.json` ke path MP3, mis. `studio/public/songs/output007.mp3`
   (atau env `BGM`).
2. Jalankan pipeline (`python -m pipeline.main ...`). `pipeline/story.py`
   menyalin file tsb ke `studio/public/stories/<slug>/bgm/<nama>` dan menulis
   `story.json.bgm = "/stories/<slug>/bgm/<nama>"`.
3. Longgar: ubah `BGM_VOLUME`/`bgm_volume` untuk mixing.

Memilih track: durasi tidak menentukan — renderer loop. Dengarkan/durasi tak
penting; pilih berdasarkan mood topik. Jika user minta BGM di video yang
dibangun manual, default-kan `output007.mp3` lalu beri tahu.

## Commands yang dipakai

```bash
# setup
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
cd studio && npm install && cd ..

# generate story (pipeline)
.venv/bin/python -m pipeline.main "Topik"            # dengan LLM/Pexels (script/terms.json otomatis dipakai)
.venv/bin/python -m pipeline.main "Topik" --script "P1.\n\nP2."
.venv/bin/python -m pipeline.main "Topik" --no-voice

# preview & edit
cd studio && npx remotion studio --props=./public/stories/<slug>/story.json

# render akhir
node scripts/render.mjs "<slug>"                     # → out/<slug>/final.mp4

# verifikasi (sebelum selesai kerja)
cd studio && npm run typecheck                        # tsc
.venv/bin/python -c "import pipeline.main, pipeline.story, pipeline.tts"
```

## Konfigurasi (`config.json`, env override)

| Key (env) | Default | Keterangan |
|---|---|---|
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | — / api.openai.com / gpt-4o-mini | OpenAI-compatible (`LLM_PROVIDER`) |
| `PEXELS_API_KEY` | — | `material_source=pexels` |
| `material_source` / `MATERIAL_SOURCE` | `pexels` | `pexels` \| `local` |
| `local_material_dir` / `LOCAL_MATERIAL_DIR` | — | folder mp4/jpg (bisa berisi subfolder; dipakai semua video di dalamnya) |
| `voice` / `voice_rate` | id-ID-ArdiNeural / 0 | Edge TTS |
| `aspect` / `ASPECT` | 9:16 | 9:16 (1080×1920) \| 16:9 \| 1:1 |
| `fps` | 30 | |
| `bgm` / `BGM` | "" | path MP3 → BGM (lihat katalog songs) |
| `bgm_volume` / `BGM_VOLUME` | 0.2 | 0–1 |
| `scene_padding` | 0.8 | detik ditambahkan setelah narasi tiap scene |
| `captions.*` | lihat `pipeline/config.py` | enabled, mode (word/sentence), position, font_size_px, warna active/dim, font_name (file di studio/public/fonts) |

## Kontrak `story.json`

Top-level: `version=1`, `subject`, `fps`, `width/height`, `duration`, `bgm`,
`bgm_volume`, `captions` (CaptionConfig), `scenes[]`.

Tiap scene: `index`, `narration`, `audio` (path), `audio_start`,
`audio_duration`, `start`, `end` (detik), `video` (`{url, duration, start_from}`
atau null), `keyword`, `captions[]` (`{text, start, end}` per kata, relatif ke
awal audio scene). `captions.font_name` (opsional, tanpa default string kosong)
menyebut file font di `studio/public/fonts/` — resolved oleh `fonts.ts`
(`FONT_MAP`); jika tidak dikenal/absent, pakai `UTM Kabel KT.ttf`.

## Konvensi & guardrail

- **`story.json` = kontrak**. Jangan merombak schema tanpa update
  `pipeline/story.py`, `studio/src/types.ts`, dan seluruh story lama.
- **Pipeline `_prune_job_dir`** mereset folder story tapi **mengawetkan**
  `script.txt` dan `terms.json` — output skill. Jangan hapus keduanya di main.
- Skill `short-video-script` HANYA menulis `script.txt` + `terms.json`;
  jangan sentuh `audio/`, `material/`, `story.json`.
- Asset besar (`local_material/`, `studio/public/`, `out/`, `.venv/`) tidak
  ter-commit. `studio/public/stories/` pun saat ini belum di-track git —
  kalau diminta commit, ikutkan sesuai konteks.
- Jangan menulis API key / secret ke file mana pun; `config.json` memakai
  string kosong & env.
- Bahasa kerja: instruksi user biasanya Bahasa Indonesia; narasi video sesuai
  bahasa yang diminta (default id), search term selalu English.
- Tooling: ffmpeg/ffprobe 9.x + yt-dlp tersedia di `/opt/homebrew/bin/`;
  TTS pakai `.venv/bin/edge-tts`.
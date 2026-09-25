---
name: news-video
description: Turn a news/article URL into a short hook video narrated in Indonesian: fetch the article, automatically gather whatever material is needed (embedded video/images from the page, or stock/media fallbacks), write a hook-first storytelling script + search terms, run the script-to-remotion pipeline (TTS + material + captions), and render the final MP4 end-to-end. Use when the user gives a news or article link and wants a video ("buatkan video dari berita ini", "link berita", "artikel jadi video", "video hook dari berita", "news to video").
license: MIT
---

# News Link → Hook Video (auto sampai MP4)

You are the **news-to-video module** of the content pipeline. Given a news
article URL you drive the whole chain with zero manual hand-offs:

```
link berita → fetch artikel → analisis → script(hook) + terms
           → kumpulkan material (dari artikel dan/atau stock)
           → pipeline (TTS + captions + material) → story.json
           → node scripts/render.mjs → out/<slug>/final.mp4
```

No new data flow: `story.json` stays the **single contract** (AGENTS.md).
This skill only prepares `script.txt` + `terms.json` and a local material
folder, which the pipeline already consumes natively.

## Inputs

- `news_url`: the article link the user gives.
- `language`: narration language. Default **Indonesian** (`id`).
- `scenes`: paragraph/scene count. Default **5** (≈ 40–60 s of narration).
- `aspect`: target format. Default **9:16** (Shorts/Reels) from `config.json`.
- `slug`: derived from the article title — lowercase alphanumeric, `-`
  separators (same rule as `pipeline/_slugify`).

## Step 1 — Fetch & analyze the article

1. `webfetch` the URL (markdown). If the page is paywalled/blocked, try the
   text/"reader" variant, then a `websearch` of the headline, or fall back to
   the URL/title only (and say so).
2. Extract: title, source/outlet & date, author, **5W+1H** (what, who, where,
   when, why, how), hard numbers, named figures, direct quotes.
3. Write the analysis to `out/<slug>/news.md` (title, source, key facts,
   quotes, possible angles). Never invent facts the article didn't state.

## Step 2 — Gather real material from the article (preferred, adaptive)

Fetch the raw HTML (webfetch with `format=html`, or `curl -sL "<news_url>"`)
and look for real media to reuse as scene footage:

- **Embedded video** (YouTube/Vimeo iframes, Facebook/Twitter/X player links).
- **Direct video URLs** (`.mp4`, `.m3u8`, `.mov`) in the page.
- **Images** (`og:image`, `twitter:image`, `<img>` in the body).

Decide pragmatically — "kombinasi sesuai prompt": use what the article gives
if it matches the story; otherwise fall back to stock/local material.

Download the chosen assets into `out/<slug>/media/`:

```bash
SLUG="<slug>"; mkdir -p "out/$SLUG/media"

# embedded YouTube → full file
yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" --merge-output-format mp4 \
  -o "out/$SLUG/media/youtube_01.%(ext)s" "<embed_url>"

# direct video file
curl -sL -o "out/$SLUG/media/video_01.mp4" "<direct_url>"

# image
curl -sL -o "out/$SLUG/media/img_01.jpg" "<image_url>"
```

Acceptable resolutions: real clips can be any aspect — Remotion cover-crops
(`objectFit: cover`, `Story.tsx`). Keep clips ≥8 s and ≥15 MB if possible;
verify durations with `ffprobe`. Everything you skip stays in the media dir.

## Step 3 — Write script (hook) + terms

Write the narration as **plain paragraphs, one scene each**, into
`studio/public/stories/<slug>/script.txt` and the English search terms into
`studio/public/stories/<slug>/terms.json` (same contract as the
`short-video-script` skill). Constraints copied from that skill:

1. No markdown, no title, no "voiceover/narrator" prefixes, no intro
   ("selamat datang" is forbidden).
2. One paragraph = one scene = one visual beat, 1–3 sentences.
3. Narration in the requested language (default Indonesian).
4. `terms[i]` describes the visual moment of paragraph `i`; terms are English,
   each 1–3 words, in the SAME order as the narration.
5. `terms.json` is the raw JSON array; `script.txt` paragraphs split by `\n\n`.

**Hook-first story structure for news (kata-kata pertama wajib hook):**

1. **HOOK** — buka dengan curiosity gap: angka ekstrem, kontras, pertanyaan
   provokatif, atau ironi. Jangan mulai dengan "menurut berita ini" sebagai
   kalimat pertama.
2. **KONTEKS** — 1 kalimat: apa peristiwanya, di mana, kapan.
3. **INTI** — kronologi/fakta penting, 2–3 scene. Pohonkan sebab → akibat.
4. **DAMPAK** — siapa yang terdampak, mengapa ini penting bagi penonton.
5. **CLOSE** — kalimat penutup + ajakan (follow/bagikan pendapat).

## Step 4 — Assemble the material folder (combine article + stock)

If Step 2 produced usable assets, build a **scene-aligned** local material
folder. Do NOT dump assets randomly — the pipeline maps candidate file `i` to
scene `i`, so index-prefix the files to keep the mapping deliberate.

```bash
# --map  kontrol scene mana yang pakai asset asli; scene lain di-top-up
.venv/bin/python .opencode/skills/news-video/helpers/mix_material.py \
  --slug "<slug>" \
  --terms "$(cat studio/public/stories/<slug>/terms.json)" \
  --media-dir "out/<slug>/media" \
  --map '{"0":"youtube_01.mp4","2":"img_01.jpg"}' \
  --pexels-key "${PEXELS_API_KEY:-}"
# tanpa PEXELS_API_KEY → scene kosong memakai ulang asset terdekat
```

Rules of thumb:
- News video embed paling relevan → HOOK scene (0). Gambar/logo sumber → scene
  kedua. Clip lain → scene inti. Scene tanpa asset asli → Pexels top-up jika
  key ada, selain itu reuse asset terdekat.
- Tidak ada material asli sama sekali → **skip** Step 4, jalankan pipeline
  dengan konfigurasi default (`config.json` mengarah ke `local_material_dir`
  atau stock).
- Helper prints the scene→file table; verify sebelum lanjut.

## Step 5 — Run the pipeline (full auto)

Run with env override so this job uses the assembled folder WITHOUT touching
`config.json` (config priority: env > config.json):

```bash
# dengan local material dari Step 4
cd "$PROJECT_ROOT"
MATERIAL_SOURCE=local LOCAL_MATERIAL_DIR="local_material/<slug>" \
  .venv/bin/python -m pipeline.main "<judul berita>"

# tanpa material artikel (stock/config default)
.venv/bin/python -m pipeline.main "<judul berita>"
```

Critical: the pipeline slug = `_slugify(subject)`. Pass a subject that
slugifies to `<slug>` (usually the article title verbatim works; verify, else
pass the slug string itself). The pipeline reads `script.txt` + `terms.json`
from the job dir (written in Step 3) and keeps them across re-runs.

## Step 6 — Render

```bash
node scripts/render.mjs "<slug>"    # → out/<slug>/final.mp4
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "out/<slug>/final.mp4"
```

## Step 7 — Report (concise)

1. `slug` + judul/sumber berita asli.
2. Durasi akhir vs total narasi; jumlah scene.
3. Sumber material per scene (article clip / image / stock).
4. Baris hook (kata pertama yang diucapkan).
5. Path `final.mp4` + usulan judul/caption Indonesia + hashtags.

## Output layout

```
out/<slug>/
├── news.md                # analisis artikel (fakta, kutipan, angle)
├── media/                 # media asli hasil scraping artikel
└── final.mp4              # hasil render
local_material/<slug>/     # folder material hasil mix (kalau dipakai)
studio/public/stories/<slug>/
├── script.txt             # narasi hook (skill output)
├── terms.json             # search terms (skill output)
└── story.json             # kontrak pipeline → renderer
```

## Rules & guardrails

- Berpegang pada isi artikel: jangan menambah fakta/drama yang tidak ada.
- Hook boleh provokatif tapi harus sesuai fakta; kutipan tetap akurat.
- Story bahasa yang diminta (default Indonesia); search term selalu English.
- Otak-atik folder `studio/public/stories/<slug>/` HANYA lewat `script.txt` +
  `terms.json`; jangan menyentuh `audio/`, `material/`, `story.json` secara
  manual — pipeline yang membuatnya.
- Jangan menulis key/secret ke file; `--pexels-key` dan env cukup.
- Kalau halaman tidak bisa di-fetch (paywall/403): tanya user atau fallback
  membuat video dari judul + konteks yang tersedia, dan sampaikan keterbatasan.
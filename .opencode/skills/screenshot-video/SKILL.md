---
name: screenshot-video
description: Build a portrait (9:16) story video from a screenshot of a tweet, X/Twitter thread, Instagram comment, TikTok comment, Reddit post, or any social media post. The screenshot is placed centered on screen over a plain or user-supplied background with background music, and an optional big emphasized hook line can sit above the screenshot. Use when the user gives a social media link and wants it turned into a video, hands over a screenshot to make a video from, or asks for a screenshot/thread/comment video ("buatkan video dari tweet ini", " dari ss ini", "video dari komentar IG", "thread jadi video", "screenshot video", "video story portrait").
license: MIT
---

# Screenshot → Portrait Story Video

Anda adalah **modul cerita-screenshot** dari content pipeline. Anda mengambil
screenshot sebuah post media sosial (tweet, thread, komentar IG/TikTok, Reddit)
lalu menyusunnya jadi **video story 9:16**: screenshot duduk di tengah layar di
atas background polos atau dari library user, musik tetap berbunyi, dan satu
baris hook besar yang di-emphasize bisa berada di atas screenshot.

```
screenshot → normalisasi (HEIC→jpg, crop konten) → pilih background
           → tulis hook + emphasis → shot.json
           → node scripts/render-shot.mjs → out/<slug>/final.mp4
```

`shot.json` adalah kontrak props untuk composition `ShotVideo`
(`studio/src/ShotVideo.tsx`), terpisah dari pipeline `story.json`. Skill ini
tidak pernah menyentuh `story.json`, `script.txt`, `terms.json`, atau `audio/`.

## Inputs

- `screenshot`: **file gambar** dari user (PNG/JPG/WEBP, atau HEIC dari iPhone).
  Ini sumber wajib.
- `source_link`: URL tweet/thread/komentar. **Hanya konteks** — dipakai untuk
  hook, subtext (username, jumlah like), dan nama file. Tidak pernah di-scrape
  atau di-screenshot oleh kamu.
- `hook`: baris besar di atas screenshot. Opsional.
- `background`: file dari `studio/public/backgrounds/`, atau warna polos.
- `music`: track dari `studio/public/songs/`.
- `duration_per_shot`: detik tiap screenshot tampil. Default **3.0**.
- `slug`: alphanumeric lowercase, pemisah `-`.

Kalau user cuma kirim **link** tanpa gambar, minta screenshot dulu. X,
Instagram, dan TikTok butuh browser yang login, jadi kamu tidak bisa
menangkapnya sendiri — katakan itu dalam satu baris lalu tunggu gambarnya.

## Step 1 — Normalisasi screenshot

Taruh file asli di folder kerja dan konversi HEIC (Photos iPhone) ke JPG,
karena Chrome tidak bisa decode HEIC:

```bash
SLUG="<slug>"
mkdir -p "out/$SLUG/src"
cp "<file yang diberikan user>" "out/$SLUG/src/01-original.<ext>"

# HEIC → JPG (macOS sips, atau ffmpeg)
sips -s format jpeg "out/$SLUG/src/01-original.heic" \
  --out "out/$SLUG/src/01.png" >/dev/null
# fallback: ffmpeg -y -i in.heic out.png
```

Cek dimensi aslinya, itu menentukan seberapa besar kartu ter-render:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height -of default=nw=1 "out/$SLUG/src/01.png"
```

**Auto-crop opsional** kalau screenshot-nya tangkapan layar penuh HP dengan
banyak ruang kosong di sekeliling post (status bar, nav bar, feed kosong). Biarkan
ffmpeg mencari kotak konten, lalu crop dan cek ulang:

```bash
ffmpeg -y -i "out/$SLUG/src/01.png" -vf cropdetect=24:2:0 -frames:v 30 \
  -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1
# lalu: ffmpeg -y -i in.png -vf "crop=W:H:X:Y,scale=900:-2" out.png
```

Crop hanya kalau jelas menguntungkan. Screenshot yang sudah rapat jangan
diutak-atik. Jangan pernah upscale — kartu maksimal ~950×930 px, jadi sumber
selebar 900 px sudah lebih dari cukup.

## Step 2 — Pilih background

Warna polos adalah default dan tidak butuh aset. Kalau user minta yang lebih,
pakai library backdrop-nya:

```bash
ls studio/public/backgrounds/     # gambar & video backdrop milik user
```

| Situasi | Setting |
|---|---|
| Default / teks panjang | `solid`, `color #0B0B0F`, `dim 0.45` |
| Foto/texture gelap | `image`, `blur 16`, `dim 0.5` |
| Loop gerakan | `video` (mp4, tanpa audio), `blur 12`, `dim 0.45` |

Kalau `studio/public/backgrounds/` masih kosong, pakai `solid` dan sebutkan
library backdrop user masih kosong supaya dia bisa menaruh file nanti.

## Step 3 — Write the hook

Opsional, tapi inilah yang bikin orang berhenti scroll. Kalau user minta hook,
tulis sendiri.

**Aturan hook (kata-kata pertama = seluruh hook):**

1. Buka dengan curiosity gap. Jangan mulai dengan "Halo", "Selamat datang",
   atau sapaan apa pun — tidak ada ruang untuk itu.
2. **2–5 kata per baris, 2–3 baris max.** Baris yang terlalu panjang wrap
   dengan hasil yang tidak tertebak di 96 px dan menabrak kartu screenshot.
3. Uppercase dipakai renderer. Tulis dengan bentuk yang paling enak dibaca.
4. Pilih 1–2 frasa untuk `--emphasis`; frasa itu dirender dengan warna aksen
   sementara sisanya tetap putih.
5. Hook harus soal **isi post**, bukan soal videonya. Jangan pakai "video ini
   akan mengubah hidupmu".
6. `--subtext` adalah pill kecil di bawah hook: `@username`, `· 12.4K likes`,
   `· 2.8K replies`, atau nama platform. Angka hanya boleh yang diberikan user.

Contoh:

| Post | Hook | Emphasis |
|---|---|---|
| Tweet tentang rebutan lowongan kerja | `WAJIB BACA SEBELUM APPLY` | `WAJIB BACA` |
| Komentar yang lucu | `GURUNYA BENER JANTAN` | `BENER JANTAN` |
| Thread tentang aset crypto direbut | `GUE SELAMAT RIBUAN DOLAR` | `RIBUAN DOLAR` |
| Komentar yang pedas | `BALASAN PALING TAJAM` | `PALING TAJAM` |

## Step 4 — Build `shot.json`

Helper menyalin screenshot ke `studio/public/stories/<slug>/shot/`, menomori
urut sesuai nama file, menyusun timeline, lalu menulis file props:

```bash
cd "$PROJECT_ROOT"

# 1 screenshot, background solid, dengan hook
.venv/bin/python .opencode/skills/screenshot-video/helpers/build_shot.py \
  --slug "<slug>" \
  --images "out/<slug>/src/01.png" \
  --subject "<judul ringkas>" \
  --hook "WAJIB BACA SEBELUM APPLY" \
  --emphasis "WAJIB BACA" \
  --subtext "@username · 12.4K likes" \
  --duration 3.0

# beberapa screenshot + background dari library user
.venv/bin/python .opencode/skills/screenshot-video/helpers/build_shot.py \
  --slug "<slug>" \
  --images "out/<slug>/src" \
  --hook "INI YANG VIRAL" \
  --emphasis "VIRAL" \
  --captions "tweet pertama|tweet kedua" \
  --bg image --bg-src "/backgrounds/dust-01.jpg" --bg-blur 16 --bg-dim 0.5 \
  --bgm "/songs/output007.mp3" --bgm-volume 0.18
```

Catatan:

- `--images` menerima file dan/atau folder; folder diurutkan berdasarkan nama
  file, jadi beri nama `01.png`, `02.png`, `03.png`.
- `python3` biasa juga jalan — helper cuma pakai stdlib. Pakai venv hanya kalau
  venv proyek memang sudah ada.
- `--bgm ""` → render tanpa musik. Default `output007.mp3` volume 0.18.
- Tuning hook setelahnya: edit `shot.json` langsung (file props biasa) lalu
  render ulang. Tidak perlu jalankan helper lagi.

## Step 5 — Verifikasi frame (murah, menangkap overflow)

Render satu still dan lihat dulu sebelum melakukan render penuh:

```bash
node scripts/render-shot.mjs "<slug>" --still 30
# → out/<slug>/preview.png
```

Perbaiki kalau melihat ini:

- Hook menabrak atau terpotong → pendekkan hook, atau turunkan `--hook-size` ke 80.
- Screenshot kekecilan → pendekkan hook, atau pakai gambar yang lebih rapat/crop.
- Backdrop terlalu mencolok → naikkan `--bg-dim` / `--bg-blur`.

Preview langsung (opsional):
`cd studio && npx remotion studio --props=./public/stories/<slug>/shot.json`.

## Step 6 — Render

```bash
node scripts/render-shot.mjs "<slug>"                 # → out/<slug>/final.mp4
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "out/<slug>/final.mp4"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of default=nw=1 "out/<slug>/final.mp4"
```

## Step 7 — Laporan

1. `slug`, dan screenshot-nya dari platform apa + nama penulis kalau diketahui.
2. Jumlah screenshot, detik per shot, durasi akhir.
3. Background yang dipakai (solid atau file mana) + musik apa.
4. Baris hook dan frasa mana yang dapat warna aksen.
5. Path `final.mp4` + usulan caption bahasa Indonesia + hashtags.

## Output layout

```
out/<slug>/
├── src/                   # screenshot asli + hasil crop/konversi
├── preview.png            # still verifikasi (kalau Step 5 jalan)
└── final.mp4              # hasil render
studio/public/stories/<slug>/
├── shot/01.png, 02.png…   # salinan screenshot (harus di dalam publicDir)
└── shot.json              # kontrak props → composition ShotVideo
```

## Kontrak `shot.json`

Top level: `version=1`, `subject`, `fps`, `width`/`height` (1080×1920), `bgm`,
`bgm_volume`, `background`, `hook`, `shots[]`.

- `background`: `type` (`solid`|`image`|`video`), `src` (path di bawah
  `studio/public`), `color`, `blur`, `dim` (0–1), `fit`.
- `hook`: `enabled`, `text`, `emphasis[]`, `subtext`, `position`
  (`top`|`bottom`), `font_size_px`, `color`, `emphasis_color`, `font_name`,
  `subtext_font_name`, `animate` (`fade`|`pop`).
- `shots[]`: `index`, `image`, `start`, `end` (detik), `zoom` (Ken Burns, 1 =
  diam), `caption`.

Path relatif terhadap `studio/public`, jadi diawali `/`:
`/stories/<slug>/shot/01.png`, `/backgrounds/x.jpg`, `/songs/output007.mp3`.
`render-shot.mjs` gagal cepat kalau `shots[].image` tidak ada.

## Rules & guardrails

- Screenshot harus datang dari user. Jangan coba fetch, scrape, atau render
  X/Instagram/TikTok/Reddit sendiri; minta gambarnya saja.
- Screenshot hanya bagian post yang membawa pesannya. Crop out feed, dinding
  "lihat lainnya", dan post lain kalau user mengizinkan.
- Kutip post secara akurat. Hook boleh provokatif, tapi jangan pernah mengarang
  angka, nama, atau klaim yang tidak ada di screenshot.
- Biarkan handle asli penulis ada di subtext. Jangan klaim konten itu milik sendiri.
- `shot.json` satu-satunya file yang ditulis skill ini di dalam
  `studio/public/stories/<slug>/`. Jangan sentuh `story.json`, `script.txt`,
  `terms.json`, `audio/`, atau `material/`.
- File di `studio/public/backgrounds/` milik user. Pakai saja, jangan hapus atau
  timpa.
- Pastikan file musik ada sebelum render: `ls studio/public/songs/` (catatan:
  `output026.mp3` tidak ada).
- `studio/public/` dan `out/` tidak di-track git; jangan di-commit kecuali
  diminta.

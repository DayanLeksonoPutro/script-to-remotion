---
name: youtube-video
description: Download any YouTube video, analyze its transcript, write an Indonesian storytelling script with a hook as the first words, then cut/paste the important segments into a new short video with ffmpeg. Use when the user asks to download a YouTube video, re-edit / re-cut an existing video, "buat video pendek dari youtube ini", "ambilkan bagian penting", "hook pembuka", "storytelling bahasa indonesia", or analyze a video URL to repurpose its content.
license: MIT
---

# YouTube Video → Indonesian Hook Video

You are the **repurposing module** of the content pipeline. You take an
existing YouTube video and turn it into a **new short video** narrated in
Indonesian: hook first, then the key moments, cut into one timeline with
ffmpeg.

Study/analyze → write hook + storytelling → cut & assemble. NO third-party
API needed: `yt-dlp` + `ffmpeg` are installed on this machine.

## Prerequisites (verified)

- `yt-dlp` (2026.08) found at `/opt/homebrew/bin/yt-dlp`.
- `ffmpeg` / `ffprobe` 9.x at `/opt/homebrew/bin/`.
- TTS (optional voice-over) via project venv:
  `MoneyPrinterTurboRemotion/.venv/bin/edge-tts`.

## Input

- `video_url`: the YouTube URL the user gives.
- `output_language`: narration language. Default **Indonesian** (`id`).
- `duration_target`: target final length in seconds. Default is derived from
  content urgency (Hook depth), typically **30–60 s** for Shorts/Reels; ask
  the user if it matters a lot.
- `slug`: derived from the video title — lowercase, alphanumeric, `-`
  separators.

## Step 1 — Download the source + subtitles

Create the output folder and download best available mp4 plus
auto-generated subtitles (used for analysis):

```bash
SLUG="<slug>"
mkdir -p "out/$SLUG"

yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" \
  --merge-output-format mp4 \
  --write-subs --write-auto-subs --sub-langs "id,en" \
  --convert-subs srt --no-check-certificate \
  -o "out/$SLUG/source.%(ext)s" "<video_url>"
```

Fallbacks:

- Video-only or audio-only download (for analysis / re-voice):
  `yt-dlp -f "bv*[ext=mp4]" -o "out/$SLUG/video_only.%(ext)s" "<URL>"`
  and `yt-dlp -f "ba" -o "out/$SLUG/audio.%(ext)s" "<URL>"`.
- If subtitles are missing (`--write-auto-subs` returned nothing): extract
  audio and note that the transcript must be built manually with timestamps
  from `ffprobe` scene/silence detection, or ask the user to re-run on a
  video that has captions.

Verify the file:
```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "out/$SLUG/source.mp4"
```

## Step 2 — Analyze: transcript → key moments

Convert the `SRT` to a timestamped transcript (readable + timecodes):

```bash
python3 - "$SLUG" <<'PY'
import re, sys, pathlib
slug = sys.argv[1]; p = pathlib.Path(f"out/{slug}/source.en.srt")
if not p.exists():
    for cand in pathlib.Path(f"out/{slug}").glob("*.srt"):
        p = cand
for f in p.parent.glob("*.srt"):
    txt = f.read_text(errors="ignore")
    blocks = re.split(r"\n\s*\n", txt.strip())
    lines = []
    for b in blocks:
        m = re.match(r"(\d+)\n(\d\d):(\d\d):(\d\d),\d+.*?\n(.*)", b, re.S)
        if not m:
            continue
        mm, ss = int(m.group(3)), int(m.group(4))
        t = int(m.group(2))*3600 + mm*60 + ss
        text = re.sub(r"<[^>]+>", "", m.group(5)).replace("\n", " ")
        lines.append(f"[{int(t//60)}:{ss:02d}] {text.strip()}")
    pathlib.Path(f"out/{slug}/transcript.txt").write_text("\n".join(lines))
    print(f"transcript.txt: {len(lines)} cues")
    break
PY
```

If no SRT was available, transcribe the audio yourself from the source by
reading it with your own capabilities (speech-to-text may not be installed;
if `whisper`/`faster-whisper` is present use it on `out/$SLUG/audio.*`).

Then **analyze the transcript** and identify:

1. **Central idea** — the one core message / payoff of the video.
2. **Story beats** — the 1–3 most valuable, emotional, or surprising moments,
   each with a concrete start/end timestamp.
3. **Quote-worthy lines** — punchy sentences worth keeping as-is.
4. **Cut-list** — final selection of segments with timestamps and a reason.

## Step 3 — Write hook + storytelling (Indonesian)

Write the timed narration/storyboard as

`out/<slug>/story.xml.beats.md` (plain text):

```
# <Judul menangkap/provokatif>
# target: <duration_target> s | source: <video_url>

## HOOK (detik X-Y) <start-end in the cut>
[First spoken line = hook. Max 2 kalimat, wajib bikin penasaran.]

## BEAT 1 — <label> (src 00:12:34 - 00:12:58)
[narasi singkat, mengapa bagian ini penting]

## BEAT 2 — ...

## CLOSE
[kalimat penutup + ajakan]
```

**Hook rules (kata awal):** the very first words must open a curiosity gap.

- Jangan mulai dengan "Halo guys", "Selamat datang", atau perkenalan.
- Gunakan pertanyaan provokatif, fakta mengejutkan, angka ekstrem,
  kontras, atau ambil kalimat paling menarik dari video aslinya.
- Contoh hooks:
  - "Begini cara kamu gagal 1000 kali tanpa sadar."
  - "10 detik pertama video ini mengubah cara aku lihat uang."
  - "(statistik mengejutkan) — dan hampir semua orang salah soal ini."
  - Potongan kalimat ikonik dari narator asli.

**Storytelling structure (bahasa Indonesia):**

1. HOOK — buka dengan gap (kata-kata pertama).
2. KONTEKS — 1 kalimat, siapkan latar.
3. INTI — rangkai cut-list jadi alur: teori → contoh → akibat.
4. KLIMAKS — momen paling kuat/emosional, durasi relatif lebih lama.
5. CLOSE — resolusi + ajakan bertindak/"follow untuk bagian X".

Narasi pendamping (opsional): kalau ingin voice-over baru, tulis narasi
terpisah `narasi.txt` (satu lokasi per beat) dalam bahasa Indonesia.

## Step 4 — Cut the key segments (ffmpeg)

Cut each selected segment from the source (fast seek + re-encode so cut
points are frame-accurate). Everything in `out/<slug>/`.

```bash
# seg_001.mp4 from 4:12 to 4:47
ffmpeg -y -ss 00:04:12 -to 00:04:47 -i "out/$SLUG/source.mp4" \
  -c:v libx264 -crf 21 -preset veryfast -c:a aac -b:a 128k \
  out/$SLUG/seg_001.mp4
```

Edge-case flags worth knowing:

- `-ss` BEFORE `-i` = fast seek; re-encode keeps timing accurate.
- If a start time is mid-scene and looks wrong, nudge ±1 s.
- If source is long, work from `transcript.txt` timestamps, not guesses.
- SEGMENT ORDER MATTERS: name them `seg_001`, `seg_002`, … in the order
  they appear in the final video (may differ from source order — reordering
  is allowed for storytelling).

## Step 5 — Assemble the final video

Concatenate in order. All segments share identical codecs from Step 4, so a
stream copy is lossless:

```bash
for i in out/$SLUG/seg_*.mp4; do echo "file '$PWD/$i'"; done > out/$SLUG/list.txt

ffmpeg -y -f concat -safe 0 -i out/$SLUG/list.txt -c copy out/$SLUG/final.mp4

ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 out/$SLUG/final.mp4
```

Optional enhancements (ask the user before doing these):

- **Re-voice narration (TTS)**: with the project venv
  ```bash
  MoneyPrinterTurboRemotion/.venv/bin/edge-tts \
    --voice id-ID-ArdiNeural --file out/$SLUG/narasi.txt \
    --write-media out/$SLUG/narasi.mp3
  ```
  then replace the segment audio with `narasi.mp3` per beat.
- **Add BGM**: pick a track from the project's library under
  `studio/public/songs/` (output000.mp3 … output029.mp3, **no output026**;
  all ~3:00 except output029 = 134 s). If the user has no preference,
  default to `output007.mp3`. Mix it at low volume under the cut audio:
  ```bash
  ffmpeg -y -i out/$SLUG/final.mp4 -i studio/public/songs/output007.mp3 \
    -filter_complex "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -shortest \
    out/$SLUG/final_bgm.mp4
  ```
  then move `final_bgm.mp4` over `final.mp4`. Adjust `volume=0.15` (0–1) for
  the right mix.
- **Vertical 9:16 for Shorts/Reels**: crop/scale with
  `ffmpeg -i final.mp4 -vf "crop=ih*9/16,scale=1080:1920" ...`.
- **Loudness normalize**: `-af loudnorm=I=-16:TP=-1.5:LRA=11`.

## Step 6 — Deliverables

Report back, concise:

1. `slug` and the title/creator of the original.
2. Original vs final duration.
3. `final.mp4` path + beat list used (each: source timestamp → label).
4. The hook line (first spoken words).
5. Suggested title + caption in Indonesian + hashtags.

## Output layout

```
out/<slug>/
├── source.mp4           # video asli (download)
├── transcript.txt       # transkrip + timestamp
├── story.xml.beats.md   # hook + storytelling + cut-list
├── seg_001..N.mp4       # potongan penting
└── final.mp4            # video pendek hasil edit
```

## Rules & guardrails

- Copyright: only re-edit material you have the right to use or that the
  user confirms they may repurpose. Keep the source & creator noted.
- Do NOT invent timestamps; derive every cut from `transcript.txt` or
  actual inspection. If unsure, re-check with `ffprobe`.
- Narration stays in the requested language (default Indonesian).
- Never fake facts the original video did not state; paraphrase honestly.
- Summary visibly present final.mp4 path so the user can open/render it.
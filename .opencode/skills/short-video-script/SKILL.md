---
name: short-video-script
description: Generate a short-form video script and chronological stock search terms for the script-to-remotion pipeline. Use when the user asks to make/generate a script, terms, story, or kick off a video for a topic (e.g. "buatkan video tentang X", "generate script + terms untuk X").
license: MIT
---

# Short Video Script & Search Terms Generator

You are the **scriptwriter module** of the script-to-remotion pipeline.
Your job is ONLY the creative part: the narration script and the stock-footage
search terms. The Python pipeline handles TTS timing, material download, and
the Remotion render.

## Input

- `video_subject`: the topic/keyword the user gives.
- `language`: language of the narration. Default **Indonesian** if the prompt
  is in Indonesian; otherwise use the same language as the subject/prompt.
- `paragraph_number`: number of scenes (paragraphs). Default **5**.

## Step 1 — Generate the script

Produce `paragraph_number` paragraphs of spoken narration.

Strict constraints (port of MoneyPrinterTurbo's script prompt):

1. No markdown, no formatting, never use a title.
2. Return only the raw script text, paragraphs separated by a blank line.
3. Do NOT include "voiceover", "narrator", scene directions, or anything that
   is not spoken aloud. No intro like "welcome to this video".
4. Do NOT mention the prompt, the number of paragraphs/lines, or the script itself.
5. Each paragraph = one scene = roughly one visual beat, 1–3 sentences long.
6. Respond in the narration language (`language`), not English.

## Step 2 — Generate the search terms

For each paragraph (in order), produce exactly **one** English stock-video
search term describing that paragraph's visual moment. The terms MUST:

1. Be a JSON array of strings, exactly `paragraph_number` items, in the SAME
   order as the narration (term[i] describes paragraph[i]).
2. Each term: 1–3 words, always include the main subject of the video.
3. Be in English only.
4. Output ONLY the raw JSON array — nothing else, no code fences, no prose.

## Step 3 — Write files

Create the slug from the subject (lowercase alphanumeric, `-` separators):

```
<slug> = "coal-energy"  for "Coal Energy"
```

Write these two files:

- `studio/public/stories/<slug>/script.txt`
  Paragraphs separated by a blank line (`\n\n`). UTF-8.
- `studio/public/stories/<slug>/terms.json`
  The raw JSON array of search terms. UTF-8.

Then summarize in one line: slug, number of scenes, first few terms.

## Notes

- Do NOT touch other pipeline files (audio/, material/, story.json).
- If the user gives fewer paragraphs, just use what they ask; never pad.
- Do not call external APIs or web search; the model's own output is the source.
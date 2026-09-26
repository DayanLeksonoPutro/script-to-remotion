# Backdrop library — `screenshot-video`

Taruh file backdrop untuk composition `ShotVideo` di folder ini. Path di
`shot.json` ditulis relatif ke `studio/public`, jadi nilainya
`/backgrounds/<nama-file>`.

## Format yang didukung

| `background.type` | File | Perilaku |
|---|---|---|
| `solid` | — | Warna polos dari `background.color`. Tanpa file. |
| `image` | `.jpg` `.jpeg` `.png` `.webp` | Still, di-cover ke 1080×1920. |
| `video` | `.mp4` `.mov` `.webm` | Diputar loop, `muted`. |

## Tips aset

- Portrait vertikal (9:16) paling aman; aspect lain tetap ter-cover otomatis.
- Untuk `image`/`video`, naikkan `blur` (12–40) dan `dim` (0.35–0.6) supaya
  screenshot di tengah tetap jadi fokus.
- Video:mpeg4/h264, tanpa audio lebih hemat dan tidak perlu `muted` manual.
- Loop dipegang renderer, jadi durasi pendek (2–5 s) tidak masalah.

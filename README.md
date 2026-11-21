# Vice Cover Lab

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/dezet96/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/dezet96/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

A free, offline web app that turns your photos and a caption into GTA-style
cover art — the multi-panel poster look with bold sunset-gradient lettering
and a Vice City neon grade — exported as a PNG to share.

## What it does

- **Any photo**: upload up to three photos, or use the bundled samples. Click
  a panel to choose which photo fills it; drag the preview to move a photo,
  scroll to zoom it.
- **Four layouts**: Hero + 3, four-panel grid, full bleed, and tilted
  snapshots with white frames.
- **Four sunset grades**: Vice Sunset, Neon Night, Golden Hour, Mono Noir.
- **Bold lettering**: a sunset-gradient Anton title, a Pacifico subtitle with
  a pink glow, and a HEAT star pill — all drawn on the cover itself.
- **Finish**: white frame, film grain, halftone dots, vignette.
- **Export**: one click to a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080.

Everything runs in the browser from static files. Photos never leave your
machine; the app makes no network request.

## Try it

```sh
node serve.ts
```

Then open http://localhost:8080. Shortcuts: `1–4` layout, `G` grade, `E` export.

## Layout

- `app/` — the web app (index.html, style.css, src/cover.js engine,
  src/editor.js editor, src/main.js bootstrap, fonts/ and samples/)
- `screenshots/` — the app at work and the covers it exported
- `main.ts` — the entry program: copies app/ and screenshots/ to /output and
  writes dossier.json with the vendored make.fun library
- `vendor/makefun-app.ts` — the kit's library, unchanged

## Fonts and samples

Lettering uses Anton, Pacifico and Bebas Neue, vendored under `app/fonts/`
under the SIL Open Font License (see `app/fonts/OFL.txt`). The two sample
photos in `app/samples/` are procedurally drawn sunset scenes made for this
entry — no real people, no game artwork. Nothing here uses a Rockstar Games
logo, artwork or font.

## License

MIT — see [LICENSE](LICENSE).

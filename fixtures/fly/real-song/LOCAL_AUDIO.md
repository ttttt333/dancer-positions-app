# Local audio (outside git)

Authorized Golden 20 files are normalized here:

```text
~/ChoreoCoreDatasets/fly-real-song/
  001_….mp3 … 020_….mp3     # original copies (renamed)
  analysis/001.wav …         # mono 44.1kHz 16-bit WAV for analysis / annotation
  catalog.json               # sha256, duration, paths
  annotations/song-00N/      # write Human GT JSON here (not in git yet)
  README.md
```

**Do not commit** audio under `fixtures/fly/real-song/audio/`.

## Analyze-ready layout

| Layer | Use |
|-------|-----|
| `NNN_Title.mp3` | Source of record + hash |
| `analysis/NNN.wav` | Stable PCM for listening / future offline analyzers |
| `catalog.json` | Machine index |

## Per-song annotation

```bash
npm run fly:annotate          # 001 から
npm run fly:annotate -- 005   # 指定曲
```

- UI: `~/ChoreoCoreDatasets/fly-real-song/workbench/`
- 1曲ガイド: `annotations/song-00N/HOW_TO.md`
- 保存先: `annotations/song-00N/annotator-a.json`

## Status

- **20/20** ready (009 re-ingested after empty-file replace)

## Human-first

While annotating, open **WAV/MP3 only** — do not load librosa/Essentia overlays.

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

## Blocked

- **009 Get Ur Freak On** — Downloads source file was **0 bytes**. Replace the mp3, then re-run normalize script / ask agent to refresh hash + wav.

## Human-first

While annotating, open **WAV/MP3 only** — do not load librosa/Essentia overlays.

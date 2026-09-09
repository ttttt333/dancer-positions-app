# Audio storage (local / private)

Place authorized audio files **outside git**, e.g.:

```
~/ChoreoCoreDatasets/fly-real-song/<songId>.wav
```

Then record `audioSha256` in `manifest.ts` (replace `PENDING_*`).

## Allowed sourceType

- `USER_OWNED`
- `LICENSED`
- `AUTHORIZED_DATASET`

## Never commit

`.mp3` `.wav` `.flac` `.m4a` `.aac` `.ogg` of copyrighted works.

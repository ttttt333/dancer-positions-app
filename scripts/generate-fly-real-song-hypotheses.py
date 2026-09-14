#!/usr/bin/env python3
"""
Batch-generate librosa AnalyzerHypothesisFile JSON for Phase 4.6 Benchmark.
Does NOT modify analyzer weights / Fusion — measurement only.

Usage:
  backend/analyzer/.venv/bin/python scripts/generate-fly-real-song-hypotheses.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np

ROOT = Path.home() / "ChoreoCoreDatasets" / "fly-real-song"
CATALOG = ROOT / "catalog.json"
OUT = ROOT / "hypotheses"
ANALYZER_VERSION = "librosa-0.11.0-beat_track-v1"
ADAPTER_VERSION = "fly-real-song-hyp-batch-1.0.0"


def uniq_sorted(xs):
    return sorted({float(x) for x in xs if np.isfinite(x) and x >= 0})


def analyze_wav(path: Path, audio_sha: str, song_id: str) -> dict:
    y, sr = librosa.load(str(path), sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = uniq_sorted(librosa.frames_to_time(beat_frames, sr=sr))
    if np.ndim(tempo) > 0:
        bpm = float(np.asarray(tempo).flat[0])
    else:
        bpm = float(tempo)
    if not np.isfinite(bpm) or bpm <= 0:
        bpm = 120.0

    # Downbeat proxy: every 4th beat from first (4/4 assumption)
    downbeats = beat_times[::4] if beat_times else []

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, units="frames"
    )
    onsets = uniq_sorted(librosa.frames_to_time(onset_frames, sr=sr))

    # Lightweight section skeleton from RMS energy blocks (not MSAF)
    rms = librosa.feature.rms(y=y)[0]
    rms_t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    n_blocks = max(4, int(duration / 15))
    edges = np.linspace(0, duration, n_blocks + 1)
    sections = []
    labels = ["INTRO", "VERSE", "CHORUS", "VERSE", "CHORUS", "BRIDGE", "OUTRO"]
    for i in range(len(edges) - 1):
        a, b = float(edges[i]), float(edges[i + 1])
        mask = (rms_t >= a) & (rms_t < b)
        energy = float(np.mean(rms[mask])) if np.any(mask) else 0.0
        if i == 0:
            lab = "INTRO"
        elif i >= n_blocks - 1:
            lab = "OUTRO"
        elif energy >= float(np.percentile(rms, 70)):
            lab = "CHORUS"
        else:
            lab = labels[i % len(labels)]
        sections.append(
            {
                "startSec": round(a, 3),
                "endSec": round(b, 3),
                "label": lab,
                "confidence": 0.4,
            }
        )

    eight = beat_times[::8] if beat_times else []

    return {
        "songId": song_id,
        "audioSha256": audio_sha,
        "analyzerId": "librosa",
        "analyzerVersion": ANALYZER_VERSION,
        "adapterVersion": ADAPTER_VERSION,
        "producedAt": datetime.now(timezone.utc).isoformat(),
        "bpm": round(bpm, 3),
        "beats": [round(t, 4) for t in beat_times],
        "downbeats": [round(t, 4) for t in downbeats],
        "onsets": [round(t, 4) for t in onsets[:5000]],
        "sections": sections,
        "eightCountStarts": [round(t, 4) for t in eight],
        "events": [
            {
                "timestamp": round(s["startSec"], 3),
                "type": "SECTION_CHANGE",
            }
            for s in sections[1:]
        ],
        "meta": {
            "durationSec": duration,
            "sr": sr,
            "note": "Batch hyp for Phase 4.6 Benchmark; sections are energy stubs not MSAF",
        },
    }


def main() -> int:
    cat = json.loads(CATALOG.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    ok = 0
    for song in cat["songs"]:
        song_id = song["songId"]
        wav_rel = song.get("analysisWav") or f"analysis/{song['id']}.wav"
        wav = ROOT / wav_rel
        if not wav.exists():
            print(f"SKIP {song_id}: missing {wav}", file=sys.stderr)
            continue
        print(f"analyze {song_id} …", flush=True)
        hyp = analyze_wav(wav, song["audioSha256"], song_id)
        dest_dir = OUT / song_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "librosa.json"
        dest.write_text(json.dumps(hyp, ensure_ascii=False, indent=2) + "\n")
        print(
            f"  wrote {dest.name} beats={len(hyp['beats'])} bpm={hyp['bpm']}",
            flush=True,
        )
        ok += 1
    # Essentia marker: explicitly unavailable
    (OUT / "ESSENTIA_STATUS.json").write_text(
        json.dumps(
            {
                "analyzerId": "essentia",
                "status": "NOT_AVAILABLE",
                "reason": "essentia Python package not installed in analyzer venv",
                "policy": "Do not invent scores; leave Essentia as NOT_AVAILABLE for this GO run",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"done {ok}/{len(cat['songs'])} librosa hypotheses")
    return 0 if ok == len(cat["songs"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())

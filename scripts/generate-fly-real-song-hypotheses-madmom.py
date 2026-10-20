#!/usr/bin/env python3
"""
Experiment B — batch madmom Beat/Downbeat hypotheses (offline only).

Does NOT replace librosa. Does NOT wire Fusion/MSAF/Formation.
Spec: docs/fly/PHASE46-MADMOM-EXPERIMENT.md

Usage:
  backend/analyzer/.venv/bin/python scripts/generate-fly-real-song-hypotheses-madmom.py
"""

from __future__ import annotations

import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

# --- numpy / madmom compatibility shims (madmom 0.16.1) ---
import numpy as np

np.float = np.float64  # noqa: A001
np.int = np.int_  # noqa: A001
np.complex = np.complex128  # noqa: A001
np.bool = bool  # noqa: A001

from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
from madmom.features.downbeats import (  # noqa: E402
    DBNDownBeatTrackingProcessor,
    RNNDownBeatProcessor,
    _process_dbn,
)

ROOT = Path.home() / "ChoreoCoreDatasets" / "fly-real-song"
CATALOG = ROOT / "catalog.json"
OUT = ROOT / "hypotheses"
ANALYZER_VERSION = "madmom-0.16.1-RNN+DBN-bps4-fps100"
ADAPTER_VERSION = "fly-real-song-madmom-exp-b-1.0.0"
EXPERIMENT_ID = "4.6-exp-madmom-beat-v1"


def _patch_downbeat_processor() -> None:
    """Fix np.asarray(results)[:,1] crash on modern numpy (inhomogeneous paths)."""

    def process(self, activations, **kwargs):  # type: ignore[no-untyped-def]
        import itertools as it

        first = 0
        if self.threshold:
            idx = np.nonzero(activations >= self.threshold)[0]
            if idx.any():
                first = max(first, np.min(idx))
                last = min(len(activations), np.max(idx) + 1)
            else:
                last = first
            activations = activations[first:last]
        if not activations.any():
            return np.empty((0, 2))
        results = list(
            self.map(_process_dbn, zip(self.hmms, it.repeat(activations)))
        )
        best = int(np.argmax([float(r[1]) for r in results]))
        path, _ = results[best]
        st = self.hmms[best].transition_model.state_space
        om = self.hmms[best].observation_model
        positions = st.state_positions[path]
        beat_numbers = positions.astype(int) + 1
        if self.correct:
            beats = np.empty(0, dtype=np.int_)
            beat_range = om.pointers[path] >= 1
            idx = np.nonzero(np.diff(beat_range.astype(np.int_)))[0] + 1
            if beat_range[0]:
                idx = np.r_[0, idx]
            if beat_range[-1]:
                idx = np.r_[idx, beat_range.size]
            if idx.any():
                for left, right in idx.reshape((-1, 2)):
                    peak = np.argmax(activations[left:right]) // 2 + left
                    beats = np.hstack((beats, peak))
        else:
            beats = np.nonzero(np.diff(beat_numbers))[0] + 1
        return np.vstack(
            ((beats + first) / float(self.fps), beat_numbers[beats])
        ).T

    DBNDownBeatTrackingProcessor.process = process  # type: ignore[method-assign]


def uniq_sorted(xs):
    return sorted({float(x) for x in xs if np.isfinite(x) and float(x) >= 0})


def analyze_wav(path: Path, audio_sha: str, song_id: str) -> dict:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        beat_act = RNNBeatProcessor()(str(path))
        beats = DBNBeatTrackingProcessor(fps=100)(beat_act)
        beats = uniq_sorted(beats)

        db_act = RNNDownBeatProcessor()(str(path))
        # Deterministic single config for all 20 (Experiment B lock)
        db = DBNDownBeatTrackingProcessor(beats_per_bar=[4], fps=100)(db_act)
        downbeats = uniq_sorted(
            [float(t) for t, b in np.asarray(db) if int(round(float(b))) == 1]
        )

    bpm = None
    if len(beats) >= 2:
        iv = float(np.median(np.diff(beats)))
        if iv > 1e-6:
            bpm = round(60.0 / iv, 3)

    return {
        "songId": song_id,
        "audioSha256": audio_sha,
        "analyzerId": "madmom",
        "analyzerVersion": ANALYZER_VERSION,
        "adapterVersion": ADAPTER_VERSION,
        "producedAt": datetime.now(timezone.utc).isoformat(),
        "bpm": bpm,
        "beats": [round(t, 4) for t in beats],
        "downbeats": [round(t, 4) for t in downbeats],
        "onsets": None,
        "sections": None,
        "eightCountStarts": [round(t, 4) for t in beats[::8]] if beats else [],
        "events": None,
        "meta": {
            "experimentId": EXPERIMENT_ID,
            "fps": 100,
            "beats_per_bar": [4],
            "pipeline": "RNNBeatProcessor+DBNBeatTrackingProcessor / RNNDownBeatProcessor+DBNDownBeatTrackingProcessor",
            "note": "Experiment B offline hyp only — not wired to Fusion/Formation",
            "compatShims": ["numpy.float aliases", "DBNDownBeatTrackingProcessor.argmax fix"],
        },
    }


def main() -> int:
    _patch_downbeat_processor()
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
        print(f"madmom analyze {song_id} …", flush=True)
        hyp = analyze_wav(wav, song["audioSha256"], song_id)
        dest_dir = OUT / song_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "madmom.json"
        dest.write_text(json.dumps(hyp, ensure_ascii=False, indent=2) + "\n")
        print(
            f"  wrote beats={len(hyp['beats'])} downs={len(hyp['downbeats'])} bpm={hyp['bpm']}",
            flush=True,
        )
        ok += 1

    (OUT / "MADMOM_EXPERIMENT_STATUS.json").write_text(
        json.dumps(
            {
                "experimentId": EXPERIMENT_ID,
                "status": "HYPS_WRITTEN",
                "analyzerVersion": ANALYZER_VERSION,
                "songs": ok,
                "producedAt": datetime.now(timezone.utc).isoformat(),
                "productionWiring": False,
                "fusion": False,
                "msaf": False,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"done {ok}/{len(cat['songs'])} madmom hypotheses")
    return 0 if ok == len(cat["songs"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())

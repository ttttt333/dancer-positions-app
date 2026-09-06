"""
song_structure_v2 → StructureResultV2 互換 dict の形状テスト。
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from services.song_structure_v2 import (
    STRUCTURE_V2_SOURCE,
    STRUCTURE_V2_VERSION,
    analyze_structure,
)

SECTION_LABELS = {
    "INTRO",
    "A_MELO",
    "B_MELO",
    "CHORUS",
    "BREAKDOWN",
    "OUTRO",
}

SECTION_KEYS = {
    "label",
    "start_eight",
    "end_eight",
    "start_time",
    "end_time",
    "cluster_id",
    "mean_energy",
    "energy_trend",
    "repeat_count",
    "confidence",
}

CHANGE_POINT_KEYS = {
    "time",
    "eight_index",
    "type",
    "is_major",
    "confidence",
    "note",
}


def _write_synthetic_wav(path: Path) -> None:
    sr = 22050
    bpm = 120.0
    beat = 60.0 / bpm

    def tone_chord(dur: float, freqs: list[float], amp: float = 0.2) -> np.ndarray:
        n = int(dur * sr)
        t = np.arange(n) / sr
        y = np.zeros(n, dtype=float)
        for f in freqs:
            y += amp * np.sin(2 * np.pi * f * t)
        env = np.linspace(0.7, 1.0, n)
        return y * env

    # イントロ静め → Aメロ → サビ(C) → バース → サビ(C) → 静めアウトロ
    parts = [
        tone_chord(4.0, [220.0], 0.08),
        tone_chord(8.0, [220.0, 277.0], 0.12),
        tone_chord(8.0, [261.63, 329.63, 392.0], 0.24),
        tone_chord(8.0, [220.0, 261.63, 329.63], 0.13),
        tone_chord(8.0, [261.63, 329.63, 392.0], 0.25),
        tone_chord(4.0, [196.0], 0.07),
    ]
    y = np.concatenate(parts).astype(np.float32)
    # わずかなノイズでゼロ列を避ける
    y += (np.random.default_rng(0).normal(0, 1e-4, size=y.shape)).astype(np.float32)
    sf.write(str(path), y, sr)


def test_analyze_structure_shape_matches_structure_result_v2():
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "synth.wav"
        _write_synthetic_wav(wav)
        result = analyze_structure(str(wav))

    assert result["source"] == STRUCTURE_V2_SOURCE
    assert result["analyzer_version"] == STRUCTURE_V2_VERSION
    assert isinstance(result["bpm"], (int, float)) and result["bpm"] > 0
    assert isinstance(result["duration"], (int, float)) and result["duration"] > 0
    assert isinstance(result["eight_times"], list) and len(result["eight_times"]) >= 1
    assert isinstance(result["sections"], list) and len(result["sections"]) >= 1
    assert isinstance(result["change_points"], list) and len(result["change_points"]) >= 1

    for sec in result["sections"]:
        assert SECTION_KEYS.issubset(sec.keys())
        assert sec["label"] in SECTION_LABELS
        assert isinstance(sec["cluster_id"], int)
        assert isinstance(sec["mean_energy"], (int, float))
        assert isinstance(sec["energy_trend"], (int, float))
        assert sec["end_time"] >= sec["start_time"]

    for cp in result["change_points"]:
        assert CHANGE_POINT_KEYS.issubset(cp.keys())
        assert isinstance(cp["is_major"], bool)
        assert isinstance(cp["type"], str) and cp["type"]


def test_repeated_chorus_shares_cluster_id_when_detectable():
    """同じ和音のサビが2回あるとき、同一 cluster_id を持つセクションが複数あること。"""
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "synth.wav"
        _write_synthetic_wav(wav)
        result = analyze_structure(str(wav))

    by_cluster: dict[int, int] = {}
    for sec in result["sections"]:
        cid = int(sec["cluster_id"])
        by_cluster[cid] = by_cluster.get(cid, 0) + 1

    # 少なくとも1クラスタが2回以上（繰り返し検出）
    assert max(by_cluster.values()) >= 2 or any(
        s["repeat_count"] >= 2 for s in result["sections"]
    )

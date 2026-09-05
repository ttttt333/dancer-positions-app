"""
section_families の純粋ロジックテスト（音声ファイル不要）。
"""

from __future__ import annotations

import numpy as np

from services.section_families import (
    _assign_variations,
    _cluster_indices,
    _segments_from_change_points,
    build_section_families,
)


def test_assign_variations():
    assert _assign_variations(1) == ["first"]
    assert _assign_variations(2) == ["first", "final"]
    assert _assign_variations(3) == ["first", "repeat", "final"]


def test_segments_from_change_points():
    cps = [
        {"time": 4.0, "section_type": "VERSE", "score": 0.4},
        {"time": 20.0, "section_type": "CHORUS_START", "score": 0.9},
        {"time": 36.0, "section_type": "VERSE", "score": 0.5},
        {"time": 52.0, "section_type": "CHORUS_START", "score": 0.92},
    ]
    segs = _segments_from_change_points(cps, 80.0)
    assert len(segs) == 4
    assert segs[1]["family_type"] == "CHORUS"
    assert segs[1]["timeEnd"] == 36.0
    assert segs[-1]["timeEnd"] == 80.0


def test_cluster_similar_indices():
    # 0↔1 高類似、2 は別
    sim = np.array(
        [
            [1.0, 0.9, 0.2],
            [0.9, 1.0, 0.25],
            [0.2, 0.25, 1.0],
        ]
    )
    clusters = _cluster_indices([0, 1, 2], sim, threshold=0.72)
    assert [0, 1] in clusters
    assert [2] in clusters


def test_build_section_families_on_synthetic_song():
    """
    同じ和音進行のサビを2回、別音色のバースを挟む簡易トーン列。
    Chroma が近いサビ同士が同じ familyId になることを期待。
    """
    sr = 22050
    bpm = 120.0
    beat = 60.0 / bpm

    def tone_chord(t0: float, dur: float, freqs: list[float], amp: float = 0.2) -> np.ndarray:
        n = int(dur * sr)
        t = np.arange(n) / sr
        y = np.zeros(n, dtype=float)
        for f in freqs:
            y += amp * np.sin(2 * np.pi * f * t)
        # 軽いエンベロープ
        env = np.linspace(0.7, 1.0, n)
        return y * env

    # C major サビ / Am バース / 再び C major サビ / ラスサビ
    parts = [
        tone_chord(0, 4.0, [220.0, 277.0], 0.12),  # verse-ish
        tone_chord(0, 8.0, [261.63, 329.63, 392.0], 0.22),  # chorus 1 (C)
        tone_chord(0, 8.0, [220.0, 261.63, 329.63], 0.14),  # verse (Am-ish)
        tone_chord(0, 8.0, [261.63, 329.63, 392.0], 0.23),  # chorus 2 (C)
        tone_chord(0, 8.0, [261.63, 329.63, 392.0], 0.28),  # chorus final (C louder)
    ]
    y = np.concatenate(parts).astype(float)
    duration = len(y) / sr
    beat_times = np.arange(0, duration, beat)

    change_points = [
        {"time": 0.5, "section_type": "VERSE", "score": 0.4, "eight_index": 0},
        {"time": 4.0, "section_type": "CHORUS_START", "score": 0.9, "eight_index": 2},
        {"time": 12.0, "section_type": "VERSE", "score": 0.5, "eight_index": 6},
        {"time": 20.0, "section_type": "CHORUS_START", "score": 0.92, "eight_index": 10},
        {"time": 28.0, "section_type": "CHORUS", "score": 0.95, "eight_index": 14},
    ]

    families = build_section_families(
        y, sr, beat_times, change_points, duration, similarity_threshold=0.65
    )
    assert isinstance(families, list)
    chorus = [f for f in families if f["type"] == "CHORUS"]
    assert len(chorus) >= 1
    top = max(chorus, key=lambda f: len(f["occurrences"]))
    assert top["familyId"].startswith("chorus-")
    assert len(top["occurrences"]) >= 2
    vars_ = [o["variation"] for o in top["occurrences"]]
    assert vars_[0] == "first"
    assert vars_[-1] == "final"
    if len(vars_) == 3:
        assert vars_[1] == "repeat"

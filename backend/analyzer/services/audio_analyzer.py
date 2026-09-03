"""
楽曲構造解析ロジック（librosa）。
4エイト（32ビート）固定ブロック + RMS音圧によるサビ判定。
peak_pick は使わない。
"""

from __future__ import annotations

from typing import Any

import librosa
import numpy as np

ANALYZER_VERSION = "algo-v1.3.0"

BEATS_PER_EIGHT = 8
EIGHTS_PER_BLOCK = 4  # 4エイト = 32ビート
BEATS_PER_BLOCK = BEATS_PER_EIGHT * EIGHTS_PER_BLOCK


def compute_song_dynamism(block_rms: np.ndarray) -> float:
    """ブロック音圧の起伏 (0〜1)。変動係数ベース"""
    if block_rms.size == 0:
        return 0.5
    cv = float(np.std(block_rms) / (np.mean(block_rms) + 1e-8))
    return float(np.clip(cv / 1.5, 0.0, 1.0))


def mark_chorus_blocks(block_rms: np.ndarray, top_ratio: float = 0.35) -> list[str]:
    """
    音圧の山をサビ連続区間にする。
    先頭が静ければ INTRO、末尾の VERSE は OUTRO、急上昇は DROP。
    """
    n = len(block_rms)
    if n == 0:
        return []
    if n == 1:
        return ["INTRO"]

    median = float(np.percentile(block_rms, 50.0))
    p65 = float(np.percentile(block_rms, 100.0 * (1.0 - top_ratio)))
    mean = float(np.mean(block_rms))
    span = float(block_rms.max() - block_rms.min()) + 1e-8

    loud = []
    for i, e in enumerate(block_rms):
        prev = float(block_rms[i - 1]) if i > 0 else float(e)
        jump = (float(e) - prev) / span
        loud.append(
            float(e) >= p65
            or (float(e) > median and jump >= 0.18)
            or float(e) >= mean + 0.12 * span
        )

    section = ["VERSE"] * n
    i = 0
    while i < n:
        if not loud[i]:
            i += 1
            continue
        j = i
        while j < n and loud[j]:
            j += 1
        section[i] = "CHORUS_START"
        for k in range(i + 1, j):
            section[k] = "CHORUS"
        i = j

    if section[0] == "VERSE":
        section[0] = "INTRO"
    for oi in range(max(0, n - 2), n):
        if section[oi] == "VERSE":
            section[oi] = "OUTRO"
    for i in range(1, n):
        rise = (float(block_rms[i]) - float(block_rms[i - 1])) / span
        if rise >= 0.28 and section[i] not in ("CHORUS_START", "INTRO"):
            section[i] = "DROP"
    return section


def analyze_track(audio_path: str) -> dict[str, Any]:
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # --- 1. ビート検出 ---
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if np.ndim(tempo) > 0:
        tempo_f = float(np.asarray(tempo).flat[0])
    else:
        tempo_f = float(tempo)
    if not np.isfinite(tempo_f) or tempo_f <= 0:
        tempo_f = 120.0

    # ビートが極端に少ない場合は等間隔で補完
    if len(beat_times) < BEATS_PER_BLOCK:
        sec_per_beat = 60.0 / tempo_f
        n_beats = max(BEATS_PER_BLOCK, int(duration / sec_per_beat))
        beat_times = np.arange(n_beats, dtype=float) * sec_per_beat
        beat_times = beat_times[beat_times < duration + 1e-6]

    # --- 2. エイトグリッド（8ビート） ---
    eights: list[dict[str, Any]] = []
    for i in range(0, len(beat_times), BEATS_PER_EIGHT):
        chunk = beat_times[i : i + BEATS_PER_EIGHT]
        if len(chunk) == BEATS_PER_EIGHT:
            eights.append({"index": i // BEATS_PER_EIGHT, "start_time": float(chunk[0])})

    if not eights:
        eights = [{"index": 0, "start_time": 0.0}]

    # --- 3. 4エイト（32ビート）ブロック ---
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)

    blocks: list[dict[str, Any]] = []
    for bi, eight_i in enumerate(range(0, len(eights), EIGHTS_PER_BLOCK)):
        start_eight = eights[eight_i]
        start_t = float(start_eight["start_time"])
        if eight_i + EIGHTS_PER_BLOCK < len(eights):
            end_t = float(eights[eight_i + EIGHTS_PER_BLOCK]["start_time"])
        else:
            end_t = duration
        if end_t <= start_t:
            continue
        mask = (rms_times >= start_t) & (rms_times < end_t)
        if np.any(mask):
            mean_rms = float(np.mean(rms[mask]))
        else:
            mean_rms = 0.0
        blocks.append(
            {
                "block_index": bi,
                "eight_index": int(start_eight["index"]),
                "time": start_t,
                "end_time": end_t,
                "mean_rms": mean_rms,
            }
        )

    if not blocks:
        blocks = [
            {
                "block_index": 0,
                "eight_index": 0,
                "time": 0.0,
                "end_time": duration,
                "mean_rms": 0.5,
            }
        ]

    block_rms = np.array([b["mean_rms"] for b in blocks], dtype=float)
    # 正規化スコア（0〜1）
    rms_min = float(block_rms.min())
    rms_max = float(block_rms.max())
    span = rms_max - rms_min + 1e-8
    block_scores = (block_rms - rms_min) / span

    section_types = mark_chorus_blocks(block_rms, top_ratio=0.35)
    song_dynamism = compute_song_dynamism(block_rms)

    sec_per_eight = (60.0 / tempo_f) * BEATS_PER_EIGHT
    eight_time = {int(e["index"]): float(e["start_time"]) for e in eights}

    change_points: list[dict[str, Any]] = []
    seen_times: set[int] = set()

    def push(eight_index: int, time: float, score: float, tier: str, stype: str) -> None:
        if not np.isfinite(time) or time < 0.4:
            return
        key = int(round(time * 10))
        if key in seen_times:
            return
        seen_times.add(key)
        change_points.append(
            {
                "eight_index": max(0, int(eight_index)),
                "time": float(time),
                "score": float(score),
                "tier": tier,
                "section_type": stype,
            }
        )

    for i, (b, stype, score) in enumerate(zip(blocks, section_types, block_scores)):
        prev = section_types[i - 1] if i > 0 else None
        eight_i = int(b["eight_index"])
        t = float(b["time"])
        if stype == "CHORUS_START":
            if prev in ("VERSE", "INTRO", "OUTRO"):
                pre_eight = eight_i - 2
                pre_t = eight_time.get(pre_eight, t - 2 * sec_per_eight)
                push(pre_eight, pre_t, min(1.0, float(score) * 0.85), "medium", "PRE_CHORUS")
            push(eight_i, t, float(score), "major", "CHORUS_START")
        elif stype == "DROP":
            push(eight_i, t, float(score), "major", "DROP")
        elif stype == "CHORUS":
            if prev in ("CHORUS", "CHORUS_START") and i % 2 == 1:
                push(
                    eight_i,
                    t,
                    float(score),
                    "major" if float(score) >= 0.75 else "medium",
                    "CHORUS",
                )
        elif stype == "OUTRO" and prev != "OUTRO":
            push(eight_i, t, float(score), "medium", "OUTRO")
        elif stype == "VERSE" and prev in ("CHORUS", "CHORUS_START", "DROP"):
            push(eight_i, t, float(score), "medium", "VERSE")

    change_points.sort(key=lambda c: c["time"])

    return {
        "bpm": tempo_f,
        "duration": duration,
        "eight_grid": eights,
        "change_points": change_points,
        "song_dynamism": song_dynamism,
        "analyzer_version": ANALYZER_VERSION,
        "block_count": len(blocks),
    }

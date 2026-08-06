"""
楽曲構造解析ロジック（librosa）。
4エイト（32ビート）固定ブロック + RMS音圧によるサビ判定。
peak_pick は使わない。
"""

from __future__ import annotations

from typing import Any

import librosa
import numpy as np

ANALYZER_VERSION = "algo-v1.1.0"

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
    上位 top_ratio（約35%）の音圧ブロックのうち連続区間を CHORUS とする。
    各連続区間の先頭は CHORUS_START、それ以外のサビは CHORUS、それ以外は VERSE。
    """
    n = len(block_rms)
    if n == 0:
        return []
    if n == 1:
        return ["CHORUS_START"]

    # 上位35% → パーセンタイル (100 - 35) = 65
    thr = float(np.percentile(block_rms, 100.0 * (1.0 - top_ratio)))
    loud = block_rms >= thr

    # 連続ランを抽出
    section = ["VERSE"] * n
    i = 0
    while i < n:
        if not loud[i]:
            i += 1
            continue
        j = i
        while j < n and loud[j]:
            j += 1
        # ラン [i, j)
        section[i] = "CHORUS_START"
        for k in range(i + 1, j):
            section[k] = "CHORUS"
        i = j
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

    # --- 4. 変化点（必ず4エイト先頭） ---
    # VERSE: 2ブロックに1回 medium、それ以外 minor
    verse_counter = 0
    change_points: list[dict[str, Any]] = []
    for b, stype, score in zip(blocks, section_types, block_scores):
        # 先頭ブロックは開始フォーメーション用に残してもよいが、
        # 生成側が開始キューを別途持つため eight_index==0 はスキップ
        if int(b["eight_index"]) == 0:
            continue

        if stype == "CHORUS_START":
            tier = "major"
        elif stype == "CHORUS":
            tier = "major" if score >= 0.75 else "medium"
        else:
            # VERSE
            tier = "medium" if verse_counter % 2 == 0 else "minor"
            verse_counter += 1

        change_points.append(
            {
                "eight_index": int(b["eight_index"]),
                "time": float(b["time"]),
                "score": float(score),
                "tier": tier,
                "section_type": stype,
                "mean_rms": float(b["mean_rms"]),
            }
        )

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

"""
楽曲構造解析ロジック（librosa）。
エイトグリッド / Novelty合成 / 動的Tier分類 / song_dynamism
"""

from __future__ import annotations

from typing import Any

import librosa
import numpy as np
from scipy.ndimage import gaussian_filter1d
from sklearn.cluster import KMeans

ANALYZER_VERSION = "algo-v1.0.0"


def normalize(x: np.ndarray) -> np.ndarray:
    return (x - x.min()) / (x.max() - x.min() + 1e-8)


def foote_novelty(ssm: np.ndarray, kernel_size: int = 32) -> np.ndarray:
    """チェッカーボードカーネルで SSM 対角上の novelty を計算"""
    half = kernel_size // 2
    kernel = np.kron([[1, -1], [-1, 1]], np.ones((half, half)))
    n = ssm.shape[0]
    novelty = np.zeros(n)
    padded = np.pad(ssm, half, mode="constant")
    for i in range(n):
        block = padded[i : i + kernel_size, i : i + kernel_size]
        novelty[i] = np.sum(block * kernel)
    return novelty


def score_to_tier(peak_scores: np.ndarray) -> list[str]:
    """ピークスコア分布を K-Means(3) で minor/medium/major に動的分類"""
    if len(peak_scores) == 0:
        return []
    if len(peak_scores) < 3:
        return ["major"] * len(peak_scores)

    X = peak_scores.reshape(-1, 1)
    km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(X)
    center_order = np.argsort(km.cluster_centers_.flatten())
    label_map = {
        int(center_order[0]): "minor",
        int(center_order[1]): "medium",
        int(center_order[2]): "major",
    }
    return [label_map[int(c)] for c in km.labels_]


def compute_song_dynamism(full_curve: np.ndarray) -> float:
    """曲全体の起伏 (0〜1)。変動係数ベース"""
    cv = float(np.std(full_curve) / (np.mean(full_curve) + 1e-8))
    return float(np.clip(cv / 1.5, 0.0, 1.0))


def analyze_track(audio_path: str) -> dict[str, Any]:
    y, sr = librosa.load(audio_path, sr=22050, mono=True)

    # --- 1. ビート検出 → エイトグリッド ---
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if np.ndim(tempo) > 0:
        tempo_f = float(np.asarray(tempo).flat[0])
    else:
        tempo_f = float(tempo)

    eights: list[dict[str, Any]] = []
    for i in range(0, len(beat_times), 8):
        chunk = beat_times[i : i + 8]
        if len(chunk) == 8:
            eights.append({"index": i // 8, "start_time": float(chunk[0])})

    # --- 2. 構造的 novelty (Foote) ---
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    ssm = librosa.segment.recurrence_matrix(chroma, mode="affinity", sym=True)
    structural_novelty = foote_novelty(ssm, kernel_size=32)

    # --- 3. エネルギー的 novelty ---
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median)

    # --- 4. 時間軸を揃えて合成 ---
    structural_novelty = np.interp(
        np.linspace(0, 1, len(onset_env)),
        np.linspace(0, 1, len(structural_novelty)),
        structural_novelty,
    )
    combined = 0.6 * normalize(structural_novelty) + 0.4 * normalize(onset_env)
    combined = gaussian_filter1d(combined, sigma=2)

    # --- 5. ピーク検出（3分でおおよそ 10〜15 点を狙うパラメータ） ---
    peaks = librosa.util.peak_pick(
        combined,
        pre_max=12,
        post_max=12,
        pre_avg=12,
        post_avg=12,
        delta=0.12,
        wait=24,
    )
    peak_times = librosa.frames_to_time(peaks, sr=sr)
    peak_scores = combined[peaks] if len(peaks) else np.array([])
    tiers = score_to_tier(peak_scores)
    song_dynamism = compute_song_dynamism(combined)

    if not eights:
        eights = [{"index": 0, "start_time": 0.0}]
    eight_starts = np.array([e["start_time"] for e in eights], dtype=float)

    # --- 6. エイトにスナップ + 重複除去 ---
    change_points: list[dict[str, Any]] = []
    seen: set[int] = set()
    for t, score, tier in zip(peak_times, peak_scores, tiers):
        idx = int(np.argmin(np.abs(eight_starts - float(t))))
        if idx in seen:
            continue
        # 曲頭のごく早い変化は無視
        if eight_starts[idx] < 2.0:
            continue
        seen.add(idx)
        change_points.append(
            {
                "eight_index": idx,
                "time": float(eight_starts[idx]),
                "score": float(score),
                "tier": tier,
            }
        )

    # 点が少なすぎる場合は 4 エイトごとに medium を補う
    if len(change_points) < 8 and len(eights) >= 8:
        for e in eights[4::4]:
            if e["index"] in seen:
                continue
            if e["start_time"] < 2.0:
                continue
            seen.add(int(e["index"]))
            change_points.append(
                {
                    "eight_index": int(e["index"]),
                    "time": float(e["start_time"]),
                    "score": 0.35,
                    "tier": "medium",
                }
            )

    change_points.sort(key=lambda c: c["time"])

    # 多すぎる場合はスコア上位を残しつつ時間順に戻す（最大 18）
    if len(change_points) > 18:
        top = sorted(change_points, key=lambda c: c["score"], reverse=True)[:18]
        change_points = sorted(top, key=lambda c: c["time"])

    return {
        "bpm": tempo_f,
        "duration": float(librosa.get_duration(y=y, sr=sr)),
        "eight_grid": eights,
        "change_points": change_points,
        "song_dynamism": song_dynamism,
        "analyzer_version": ANALYZER_VERSION,
    }

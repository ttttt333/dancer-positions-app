"""
song_structure_v2.py
=========================================================
CHOREOCORE 曲構造解析エンジン v2

旧ロジック（音圧だけを見て「大きい山」をサビとみなす）に対して、
  1. クロマ特徴量による自己類似度行列(SSM)      — 「繰り返し」を検出する軸を追加
  2. オンセット強度によるエイト位相合わせ          — BPM一発積み上げのドリフトを回避
  3. ブロック(32拍)固定グリッドをやめ、エイト(8拍)単位のスナップに変更
  4. BREAKDOWN（急な音圧低下）を DROP の逆として新設
  5. セグメントのクラスタリングにより Aメロ/Bメロ/サビ を「旋律の同一性」で判定
を行い、INTRO / A_MELO / B_MELO / CHORUS / BREAKDOWN / OUTRO の
6区分でセクションと変化点(ChangePoint)を出力する。

依存ライブラリはすべて MIT/BSD 系（numpy, scipy, librosa）。
madmom は意図的に使わない — ダウンビート推定に使われる DBN 後処理部分が
開発者の特許で非商用ライセンス限定になっており、商用製品には組み込めないため。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from typing import Literal

import numpy as np
import librosa
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform
from scipy.signal import find_peaks


SectionLabel = Literal["INTRO", "A_MELO", "B_MELO", "CHORUS", "BREAKDOWN", "OUTRO"]

# 既存の ChangePoint.type と後方互換にするためのマッピング
LEGACY_TYPE_MAP = {
    "INTRO": "INTRO",
    "A_MELO": "VERSE",
    "B_MELO": "B_MELO",        # 新規
    "CHORUS": "CHORUS_START",  # 出力時は先頭のみ CHORUS_START、以降は CHORUS
    "BREAKDOWN": "BREAKDOWN",  # 新規（DROP の逆）
    "OUTRO": "OUTRO",
}


@dataclass
class Section:
    label: str
    start_eight: int
    end_eight: int
    start_time: float
    end_time: float
    cluster_id: int
    mean_energy: float
    energy_trend: float
    repeat_count: int
    confidence: float


@dataclass
class ChangePointV2:
    time: float
    eight_index: int
    type: str
    is_major: bool
    confidence: float
    note: str = ""


@dataclass
class StructureResult:
    bpm: float
    duration: float
    eight_times: list
    sections: list
    change_points: list
    source: str = "chroma-ssm-v2"

    def to_json(self) -> str:
        def conv(o):
            if isinstance(o, np.floating):
                return float(o)
            if isinstance(o, np.integer):
                return int(o)
            if isinstance(o, np.ndarray):
                return o.tolist()
            raise TypeError(f"not serializable: {type(o)}")
        return json.dumps(asdict(self), default=conv, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------
# 1. ビート / エイト グリッド
# ---------------------------------------------------------------------

def _estimate_beats(y: np.ndarray, sr: int):
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    bpm = float(np.atleast_1d(tempo)[0])
    if len(beat_frames) < 8:
        period = 60.0 / max(bpm, 1e-6)
        n = max(int(len(y) / sr / period), 8)
        return bpm, np.arange(n) * period
    return bpm, librosa.frames_to_time(beat_frames, sr=sr)


def _align_eight_phase(y: np.ndarray, sr: int, beat_times: np.ndarray) -> int:
    """
    「フレーズの頭はアクセントが強い」という経験則だけで、8拍グループの
    位相(0-7)を推定する軽量版。madmomのDBN(非商用ライセンス)は使わない。
    """
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr)
    accents = np.interp(beat_times, onset_times, onset_env)
    n = len(accents)
    if n < 8:
        return 0
    best_phase, best_score = 0, -np.inf
    for phase in range(8):
        idx = np.arange(phase, n, 8)
        if len(idx) == 0:
            continue
        score = accents[idx].mean()
        if score > best_score:
            best_score, best_phase = score, phase
    return best_phase


def build_beat_grid(y: np.ndarray, sr: int):
    bpm, beat_times = _estimate_beats(y, sr)
    phase = _align_eight_phase(y, sr, beat_times)
    starts = list(range(phase, len(beat_times), 8))
    if phase > 0:
        starts = [0] + starts
    eight_beat_idx = np.array(sorted(set(starts)), dtype=int)
    eight_times = beat_times[eight_beat_idx]
    return bpm, beat_times, eight_beat_idx, eight_times


# ---------------------------------------------------------------------
# 2. ビート同期特徴量
# ---------------------------------------------------------------------

def extract_beat_synced_features(y: np.ndarray, sr: int, beat_times: np.ndarray):
    beat_frames = np.unique(np.clip(librosa.time_to_frames(beat_times, sr=sr), 0, None))
    chroma = librosa.feature.chroma_cens(y=y, sr=sr)
    rms = librosa.feature.rms(y=y)[0]
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    rms_sync = librosa.util.sync(rms.reshape(1, -1), beat_frames, aggregate=np.mean)[0]
    rms_sync = rms_sync / (rms_sync.max() + 1e-9)
    return chroma_sync, rms_sync


# ---------------------------------------------------------------------
# 3. 自己類似度 & ノベルティ曲線
# ---------------------------------------------------------------------

def chroma_ssm(chroma_sync: np.ndarray) -> np.ndarray:
    X = chroma_sync.T
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    Xn = X / norms
    return Xn @ Xn.T


def block_contrast_novelty(ssm: np.ndarray, half_window: int = 8) -> np.ndarray:
    """
    Foote(2000)のチェッカーボードカーネルの簡易版。
    各点で「前半区間の内部類似度」「後半区間の内部類似度」の平均から
    「前半後半をまたぐ類似度」を引く。値が高いほど、その点の前後で
    音楽内容が変わった＝構造的な境界らしい、という指標になる。
    """
    n = ssm.shape[0]
    k = half_window
    novelty = np.zeros(n)
    for i in range(1, n - 1):
        lo, hi = max(0, i - k), min(n, i + k)
        if (i - lo) < 2 or (hi - i) < 2:
            continue
        before = ssm[lo:i, lo:i]
        after = ssm[i:hi, i:hi]
        cross = ssm[lo:i, i:hi]
        novelty[i] = 0.5 * (before.mean() + after.mean()) - cross.mean()
    novelty = np.clip(novelty, 0, None)
    if novelty.max() > 0:
        novelty /= novelty.max()
    return novelty


def energy_derivative(rms_sync: np.ndarray) -> np.ndarray:
    """符号付き。正=急上昇(DROP方向)、負=急降下(BREAKDOWN方向)。"""
    if len(rms_sync) < 2:
        return np.zeros_like(rms_sync)
    return np.gradient(rms_sync)


# ---------------------------------------------------------------------
# 4. 境界検出（エイト単位にスナップ）
# ---------------------------------------------------------------------

def detect_boundaries(struct_nov: np.ndarray, energy_nov_abs: np.ndarray,
                       eight_beat_idx: np.ndarray, min_gap_beats: int = 4,
                       merge_gap_beats: int = 6):
    """構造ノベルティとエネルギーノベルティ、両方のピークの和集合を候補にし、
    最も近いエイト境界へスナップする。戻り値は eight_beat_idx 上の「位置(index)」のリスト。

    prominence（周囲との差）を使うのがポイント: 曲中で一番派手な瞬間（例:サビ入り）を
    基準に正規化した height だと、それより控えめだが実在する変化点（Aメロ→Bメロ等）が
    埋もれてしまうため。"""
    peaks_a, _ = find_peaks(struct_nov, distance=min_gap_beats, prominence=0.08)
    peaks_b, _ = find_peaks(energy_nov_abs, distance=min_gap_beats, prominence=0.08)
    candidates = sorted(set(peaks_a.tolist()) | set(peaks_b.tolist()))

    # 構造/エネルギー由来の候補が数拍以内に近接している場合は、境目の"二重検出"なので
    # 強い方だけを残してマージする（セクション境界の直前直後で両方が反応しがちなため）
    merged = []
    for c in candidates:
        strength_c = max(struct_nov[c], energy_nov_abs[c])
        if merged and (c - merged[-1][0]) <= merge_gap_beats:
            if strength_c > merged[-1][1]:
                merged[-1] = (c, strength_c)
        else:
            merged.append((c, strength_c))

    snapped_strength = {}  # eight位置(index) -> 強度
    for c, strength_c in merged:
        pos = int(np.argmin(np.abs(eight_beat_idx - c)))
        if pos not in snapped_strength or strength_c > snapped_strength[pos]:
            snapped_strength[pos] = strength_c

    snapped_strength.setdefault(0, 0.3)  # 先頭は必ず境界に含める
    positions = sorted(snapped_strength.keys())
    return positions, snapped_strength


# ---------------------------------------------------------------------
# 5. セグメントのクラスタリング（繰り返し検出）
# ---------------------------------------------------------------------

def resample_sequence(chroma_slice: np.ndarray, n_steps: int = 8) -> np.ndarray:
    """(12, T) の系列を (12, n_steps) に線形補間でリサンプルする。
    平均/中央値と違い時間順を保つので、「同じ4和音でも並び順が違う」セクション同士を
    誤って同一クラスタにしない（コード進行の"パターン"を比較できる）。"""
    n_pitch, T = chroma_slice.shape
    if T == 0:
        return np.zeros((n_pitch, n_steps))
    if T == 1:
        return np.repeat(chroma_slice, n_steps, axis=1)
    x_old = np.linspace(0, 1, T)
    x_new = np.linspace(0, 1, n_steps)
    out = np.zeros((n_pitch, n_steps))
    for p in range(n_pitch):
        out[p] = np.interp(x_new, x_old, chroma_slice[p])
    return out


def cluster_segments(chroma_sync, beat_times, eight_times, segment_bounds, seq_steps: int = 8):
    n_seg = len(segment_bounds) - 1
    n_eights = len(eight_times)
    seg_vectors, seg_beat_ranges = [], []

    for i in range(n_seg):
        start_pos, end_pos = segment_bounds[i], segment_bounds[i + 1]
        t0 = eight_times[start_pos]
        if end_pos < n_eights:
            t1 = eight_times[end_pos]
        else:
            step = (beat_times[-1] - beat_times[-2]) if len(beat_times) > 1 else 1.0
            t1 = beat_times[-1] + step
        b0 = int(np.searchsorted(beat_times, t0, side="left"))
        b1 = int(np.searchsorted(beat_times, t1, side="left"))
        b1 = min(max(b1, b0 + 1), chroma_sync.shape[1])
        b0 = min(b0, max(b1 - 1, 0))
        seg_beat_ranges.append((b0, b1))
        resampled = resample_sequence(chroma_sync[:, b0:b1], n_steps=seq_steps)
        vec = resampled.flatten()  # 時間順を保った (12*seq_steps,) の指紋
        seg_vectors.append(vec)

    if n_seg <= 1:
        return [1] * n_seg, seg_beat_ranges

    X = np.array(seg_vectors)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    Xn = X / norms
    dist = 1 - (Xn @ Xn.T)
    dist = np.clip((dist + dist.T) / 2, 0, None)
    np.fill_diagonal(dist, 0)
    condensed = squareform(dist, checks=False)
    Z = linkage(condensed, method="average")
    labels = fcluster(Z, t=0.35, criterion="distance")
    return labels.tolist(), seg_beat_ranges


# ---------------------------------------------------------------------
# 6. セクションのラベリング
# ---------------------------------------------------------------------

def label_sections(segment_bounds, cluster_labels, seg_beat_ranges,
                    rms_sync, eight_times, energy_delta_by_pos):
    n_seg = len(segment_bounds) - 1
    n_eights = len(eight_times)
    stats = []
    for i in range(n_seg):
        b0, b1 = seg_beat_ranges[i]
        seg_rms = rms_sync[b0:b1] if b1 > b0 else rms_sync[b0:b0 + 1]
        mean_e = float(seg_rms.mean()) if len(seg_rms) else 0.0
        if len(seg_rms) >= 2:
            trend = float(np.polyfit(np.arange(len(seg_rms)), seg_rms, 1)[0])
        else:
            trend = 0.0
        stats.append({"mean_energy": mean_e, "trend": trend, "cluster": cluster_labels[i],
                       "len_beats": b1 - b0})

    repeat_count = {}
    for s in stats:
        repeat_count[s["cluster"]] = repeat_count.get(s["cluster"], 0) + 1

    cluster_scores = {}
    for cid in set(s["cluster"] for s in stats):
        energies = [s["mean_energy"] for s in stats if s["cluster"] == cid]
        cluster_scores[cid] = float(np.mean(energies)) * (repeat_count[cid] ** 1.5)
    repeated = {c: v for c, v in cluster_scores.items() if repeat_count[c] >= 2}
    chorus_cluster = max(repeated, key=repeated.get) if repeated else max(cluster_scores, key=cluster_scores.get)

    labels = [None] * n_seg
    median_energy = float(np.median([s["mean_energy"] for s in stats]))

    for i, s in enumerate(stats):
        if s["cluster"] == chorus_cluster:
            labels[i] = "CHORUS"

    if labels[0] is None and (stats[0]["mean_energy"] <= median_energy or n_seg == 1):
        labels[0] = "INTRO"
    if n_seg > 1 and labels[-1] is None and stats[-1]["mean_energy"] <= median_energy:
        labels[-1] = "OUTRO"

    for i, s in enumerate(stats):
        if labels[i] is not None:
            continue
        next_is_chorus = (i + 1 < n_seg) and (stats[i + 1]["cluster"] == chorus_cluster)
        short_ish = s["len_beats"] <= 12
        if next_is_chorus and s["trend"] > 0.005 and short_ish:
            labels[i] = "B_MELO"

    for i in range(n_seg):
        if labels[i] is None:
            labels[i] = "A_MELO"

    # BREAKDOWN パス: 直前からの急降下 + 低エネルギーなら上書き（OUTROは除く）
    for i in range(1, n_seg):
        pos = segment_bounds[i]
        delta = energy_delta_by_pos.get(pos, 0.0)
        if delta < -0.05 and stats[i]["mean_energy"] < median_energy and labels[i] != "OUTRO":
            labels[i] = "BREAKDOWN"

    sections = []
    for i in range(n_seg):
        s = stats[i]
        conf = float(np.clip(0.55 + 0.20 * min(repeat_count[s["cluster"]] - 1, 2), 0.3, 0.95))
        end_pos = segment_bounds[i + 1]
        end_time = float(eight_times[end_pos]) if end_pos < n_eights else float(eight_times[-1])
        sections.append(Section(
            label=labels[i],
            start_eight=int(segment_bounds[i]),
            end_eight=int(end_pos),
            start_time=float(eight_times[segment_bounds[i]]),
            end_time=end_time,
            cluster_id=int(s["cluster"]),
            mean_energy=round(s["mean_energy"], 4),
            energy_trend=round(s["trend"], 4),
            repeat_count=repeat_count[s["cluster"]],
            confidence=round(conf, 2),
        ))
    return sections


def sections_to_change_points(sections: list[Section]) -> list[ChangePointV2]:
    cps = []
    for i, s in enumerate(sections):
        type_ = LEGACY_TYPE_MAP[s.label]
        if s.label == "CHORUS" and i > 0 and sections[i - 1].label == "CHORUS":
            type_ = "CHORUS"
        is_major = s.label in ("CHORUS", "BREAKDOWN")
        note = ""
        if s.label == "CHORUS" and s.energy_trend >= 0 and s.mean_energy > 0.55:
            note = "DROP的な急上昇"
        cps.append(ChangePointV2(
            time=s.start_time,
            eight_index=s.start_eight,
            type=type_,
            is_major=bool(is_major),
            confidence=s.confidence,
            note=note,
        ))
    return cps


# ---------------------------------------------------------------------
# 公開API
# ---------------------------------------------------------------------

STRUCTURE_V2_SOURCE = "chroma-ssm-v2"
STRUCTURE_V2_VERSION = "structure-v2.0.0"


def _json_safe(value):
    """numpy スカラー等を JSON シリアライズ可能な Python 型へ。"""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


def structure_result_to_dict(result: StructureResult) -> dict:
    """
    TypeScript `StructureResultV2` とフィールド対応する dict を返す。
    sections / change_points は dataclass → dict 済みの場合と生の場合の両方に対応。
    """
    sections = result.sections
    if sections and hasattr(sections[0], "__dataclass_fields__"):
        sections = [asdict(s) for s in sections]
    change_points = result.change_points
    if change_points and hasattr(change_points[0], "__dataclass_fields__"):
        change_points = [asdict(c) for c in change_points]

    return _json_safe(
        {
            "bpm": result.bpm,
            "duration": result.duration,
            "eight_times": list(result.eight_times),
            "sections": sections,
            "change_points": change_points,
            "source": result.source or STRUCTURE_V2_SOURCE,
            "analyzer_version": STRUCTURE_V2_VERSION,
        }
    )


def analyze(path: str) -> StructureResult:
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = len(y) / sr

    bpm, beat_times, eight_beat_idx, eight_times = build_beat_grid(y, sr)
    chroma_sync, rms_sync = extract_beat_synced_features(y, sr, beat_times)

    n = min(chroma_sync.shape[1], len(rms_sync), len(beat_times))
    chroma_sync, rms_sync, beat_times = chroma_sync[:, :n], rms_sync[:n], beat_times[:n]
    keep = eight_beat_idx < n
    eight_beat_idx, eight_times = eight_beat_idx[keep], eight_times[keep]

    ssm = chroma_ssm(chroma_sync)
    struct_nov = block_contrast_novelty(ssm)
    energy_deriv = energy_derivative(rms_sync)
    energy_nov_abs = np.abs(energy_deriv)
    if energy_nov_abs.max() > 0:
        energy_nov_abs = energy_nov_abs / energy_nov_abs.max()

    change_positions, _info = detect_boundaries(struct_nov, energy_nov_abs, eight_beat_idx)
    segment_bounds = change_positions + [len(eight_times)]

    cluster_labels, seg_beat_ranges = cluster_segments(
        chroma_sync, beat_times, eight_times, segment_bounds
    )

    energy_delta_by_pos = {
        pos: float(energy_deriv[eight_beat_idx[pos]]) for pos in change_positions
    }

    sections = label_sections(
        segment_bounds,
        cluster_labels,
        seg_beat_ranges,
        rms_sync,
        eight_times,
        energy_delta_by_pos,
    )
    change_points = sections_to_change_points(sections)

    return StructureResult(
        bpm=round(bpm, 2),
        duration=round(duration, 2),
        eight_times=[round(float(t), 3) for t in eight_times],
        sections=[asdict(s) for s in sections],
        change_points=[asdict(c) for c in change_points],
        source=STRUCTURE_V2_SOURCE,
    )


def analyze_structure(path: str) -> dict:
    """
    FastAPI / テスト向けエントリ。StructureResultV2 互換 dict を返す。
    """
    return structure_result_to_dict(analyze(path))


if __name__ == "__main__":
    import sys
    result = analyze(sys.argv[1])
    print(result.to_json())

"""
セクション家族検出（Chroma + MFCC のビート同期類似度）。
音圧ベースの change_points 区間同士をクラスタし、section_families を返す。
解析失敗時は空配列（既存経路を壊さない）。
"""

from __future__ import annotations

from typing import Any

import librosa
import numpy as np
from numpy.typing import NDArray

# コサイン類似度がこれ以上なら同じ家族候補
DEFAULT_SIMILARITY_THRESHOLD = 0.72

CHORUS_LIKE = frozenset({"CHORUS_START", "CHORUS", "DROP", "FINAL_CHORUS"})
VERSE_LIKE = frozenset({"VERSE", "INTRO"})


def _map_family_type(section_type: str) -> str:
    st = (section_type or "UNKNOWN").upper()
    if st in ("CHORUS_START", "CHORUS", "FINAL_CHORUS"):
        return "CHORUS"
    if st == "DROP":
        return "DROP"
    if st == "PRE_CHORUS" or st == "SE_TRIGGER":
        return "PRE_CHORUS"
    if st == "INTRO":
        return "INTRO"
    if st == "OUTRO":
        return "OUTRO"
    if st == "BREAK":
        return "BREAK"
    if st == "BRIDGE":
        return "BRIDGE"
    if st == "VERSE":
        return "VERSE"
    return "UNKNOWN"


def _segments_from_change_points(
    change_points: list[dict[str, Any]],
    duration: float,
) -> list[dict[str, Any]]:
    """change_points の開始時刻から次の境界までを区間にする。"""
    if not change_points or duration <= 0:
        return []
    sorted_cps = sorted(
        (cp for cp in change_points if np.isfinite(float(cp.get("time", -1)))),
        key=lambda c: float(c["time"]),
    )
    if not sorted_cps:
        return []
    segs: list[dict[str, Any]] = []
    for i, cp in enumerate(sorted_cps):
        start = float(cp["time"])
        end = float(sorted_cps[i + 1]["time"]) if i + 1 < len(sorted_cps) else float(duration)
        if end <= start + 0.25:
            continue
        stype = str(cp.get("section_type") or "VERSE")
        segs.append(
            {
                "timeStart": start,
                "timeEnd": end,
                "section_type": stype,
                "family_type": _map_family_type(stype),
                "score": float(cp.get("score") or 0.5),
            }
        )
    return segs


def _beat_sync_features(
    y: NDArray[np.floating],
    sr: int,
    beat_times: NDArray[np.floating],
) -> tuple[NDArray[np.floating], NDArray[np.floating]]:
    """
    ビート同期 Chroma(12) + MFCC(13)。
    戻り: (feat_per_beat [n_beats, 25], beat_times_used [n_beats])
    """
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)

    if beat_times.size < 2:
        chroma_m = np.mean(chroma, axis=1)
        mfcc_m = np.mean(mfcc, axis=1)
        feat = np.concatenate([chroma_m, mfcc_m]).astype(float)
        return feat.reshape(1, -1), np.array([0.0], dtype=float)

    beat_frames = librosa.time_to_frames(beat_times, sr=sr, hop_length=hop)
    beat_frames = librosa.util.fix_frames(
        beat_frames, x_min=0, x_max=chroma.shape[1] - 1
    )
    if beat_frames.size < 1:
        chroma_m = np.mean(chroma, axis=1)
        mfcc_m = np.mean(mfcc, axis=1)
        feat = np.concatenate([chroma_m, mfcc_m]).astype(float)
        return feat.reshape(1, -1), np.array([0.0], dtype=float)

    # sync は境界を pad して全フレームを覆う
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.mean, pad=True)
    mfcc_sync = librosa.util.sync(mfcc, beat_frames, aggregate=np.mean, pad=True)
    feat = np.vstack([chroma_sync, mfcc_sync]).T.astype(float)

    # pad 後の列数に合わせた時刻（各ビート区間の開始）
    bt = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    if feat.shape[0] == bt.shape[0] + 1:
        # pad で先頭 [0, first) が増えた場合
        bt = np.concatenate([[0.0], bt])
    n = min(feat.shape[0], bt.shape[0])
    return feat[:n], bt[:n]


def _segment_vectors(
    feat: NDArray[np.floating],
    beat_t: NDArray[np.floating],
    segments: list[dict[str, Any]],
) -> NDArray[np.floating]:
    """区間ごとの平均特徴ベクトル。空区間はゼロ。"""
    dim = feat.shape[1] if feat.size else 25
    out = np.zeros((len(segments), dim), dtype=float)
    if feat.size == 0 or beat_t.size == 0:
        return out
    for i, seg in enumerate(segments):
        mask = (beat_t >= seg["timeStart"]) & (beat_t < seg["timeEnd"])
        if not np.any(mask):
            # 近傍1ビート
            mid = 0.5 * (seg["timeStart"] + seg["timeEnd"])
            j = int(np.argmin(np.abs(beat_t - mid)))
            out[i] = feat[j]
        else:
            out[i] = np.mean(feat[mask], axis=0)
        norm = np.linalg.norm(out[i]) + 1e-8
        out[i] = out[i] / norm
    return out


def _cosine_sim_matrix(vectors: NDArray[np.floating]) -> NDArray[np.floating]:
    n = vectors.shape[0]
    sim = np.eye(n, dtype=float)
    for i in range(n):
        for j in range(i + 1, n):
            s = float(np.dot(vectors[i], vectors[j]))
            sim[i, j] = s
            sim[j, i] = s
    return sim


def _cluster_indices(
    indices: list[int],
    sim: NDArray[np.floating],
    threshold: float,
) -> list[list[int]]:
    """貪欲クラスタ: 類似度 threshold 以上を同一家族にまとめる。"""
    if not indices:
        return []
    remaining = sorted(indices)
    clusters: list[list[int]] = []
    while remaining:
        seed = remaining.pop(0)
        group = [seed]
        keep: list[int] = []
        for j in remaining:
            # クラスタ代表（平均類似）ではなく seed と各員の最大で判定
            if any(sim[j, m] >= threshold for m in group):
                group.append(j)
            else:
                keep.append(j)
        remaining = keep
        clusters.append(sorted(group))
    return clusters


def _assign_variations(n: int) -> list[str]:
    if n <= 0:
        return []
    if n == 1:
        return ["first"]
    out = ["first"]
    for _ in range(1, n - 1):
        out.append("repeat")
    out.append("final")
    return out


def build_section_families(
    y: NDArray[np.floating],
    sr: int,
    beat_times: NDArray[np.floating],
    change_points: list[dict[str, Any]],
    duration: float,
    *,
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> list[dict[str, Any]]:
    """
    フロントの SectionFamily 形:
    { familyId, type, occurrences: [{ timeStart, timeEnd, variation }] }
    """
    segments = _segments_from_change_points(change_points, duration)
    if len(segments) < 1:
        return []

    try:
        feat, beat_t = _beat_sync_features(y, sr, np.asarray(beat_times, dtype=float))
        vectors = _segment_vectors(feat, beat_t, segments)
        sim = _cosine_sim_matrix(vectors)
    except Exception:  # noqa: BLE001
        return []

    families: list[dict[str, Any]] = []

    # サビ系・VERSE系を別々にクラスタ（PRE_CHORUS は家族にしない）
    group_specs: list[tuple[str, frozenset[str], str]] = [
        ("chorus", CHORUS_LIKE, "chorus"),
        ("verse", VERSE_LIKE, "verse"),
    ]
    for label_prefix, type_set, id_prefix in group_specs:
        idxs = [i for i, s in enumerate(segments) if s["section_type"] in type_set]
        clusters = _cluster_indices(idxs, sim, similarity_threshold)
        clusters.sort(key=lambda c: (segments[c[0]]["timeStart"], -len(c)))

        letter_i = 0
        for cluster in clusters:
            if label_prefix == "chorus":
                # 単発の弱い DROP だけは家族にしない
                if len(cluster) == 1 and segments[cluster[0]]["section_type"] == "DROP":
                    if segments[cluster[0]]["score"] < 0.7:
                        continue
                if letter_i < 26:
                    family_id = f"{id_prefix}-{chr(ord('A') + letter_i)}"
                else:
                    family_id = f"{id_prefix}-{letter_i + 1}"
            else:
                family_id = f"{id_prefix}-{letter_i + 1}"
            letter_i += 1

            types = [segments[i]["family_type"] for i in cluster]
            if "CHORUS" in types:
                ftype = "CHORUS"
            elif "DROP" in types:
                ftype = "DROP"
            else:
                ftype = types[0] if types else "UNKNOWN"

            ordered = sorted(cluster, key=lambda i: segments[i]["timeStart"])
            variations = _assign_variations(len(ordered))
            occurrences = [
                {
                    "timeStart": float(segments[i]["timeStart"]),
                    "timeEnd": float(segments[i]["timeEnd"]),
                    "variation": variations[k],
                }
                for k, i in enumerate(ordered)
            ]
            families.append(
                {
                    "familyId": family_id,
                    "type": ftype,
                    "occurrences": occurrences,
                }
            )

    families.sort(
        key=lambda f: (
            0 if f["type"] in ("CHORUS", "DROP") else 1,
            f["occurrences"][0]["timeStart"] if f["occurrences"] else 0.0,
        )
    )
    return families

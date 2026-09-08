"""
All-In-One Music Structure Analysis via Replicate.

モデル: sakemin/all-in-one-music-structure-analyzer（または互換の cwalo fork）
- BPM / beats / downbeats / functional segments
- オプションで demucs 系の stem 分離（demux=true）

REPLICATE_API_TOKEN が無い、または REPLICATE_AIO_MOCK=1 のときは
決定論的モックを返す（ローカル開発・CI 用）。
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx

AIO_SOURCE = "all-in-one-replicate"
AIO_VERSION = "all-in-one-v1.0.0"

# モデル名で最新を叩く（owner/name）。必要なら REPLICATE_AIO_VERSION で固定ハッシュも可。
REPLICATE_MODEL = os.environ.get(
    "REPLICATE_AIO_MODEL",
    "sakemin/all-in-one-music-structure-analyzer",
)


def _label_to_v2(label: str) -> str:
    u = (label or "verse").strip().lower().replace("-", "_").replace(" ", "_")
    if u in ("intro",):
        return "INTRO"
    if u in ("outro", "ending"):
        return "OUTRO"
    if u in ("chorus", "refrain"):
        return "CHORUS"
    if u in ("bridge", "interlude", "inst", "instrumental", "break", "breakdown", "solo"):
        return "BREAKDOWN"
    if u in ("pre_chorus", "prechorus"):
        return "B_MELO"
    return "A_MELO"


def mock_all_in_one_structure(duration: float = 96.0, bpm: float = 120.0) -> dict[str, Any]:
    """Replicate 未設定時のデモ用 StructureResultV2 互換 JSON。"""
    spb = 60.0 / max(bpm, 1.0)
    beats: list[float] = []
    downbeats: list[float] = []
    t = 0.0
    i = 0
    while t <= duration + 1e-9:
        beats.append(round(t, 3))
        if i % 8 == 0:
            downbeats.append(round(t, 3))
        i += 1
        t = i * spb

    raw_segments = [
        (0.0, 8.0, "intro"),
        (8.0, 24.0, "verse"),
        (24.0, 32.0, "pre-chorus"),
        (32.0, 48.0, "chorus"),
        (48.0, 56.0, "verse"),
        (56.0, 64.0, "bridge"),
        (64.0, 80.0, "chorus"),
        (80.0, duration, "outro"),
    ]
    sections = []
    change_points = []
    for idx, (start, end, lab) in enumerate(raw_segments):
        if start >= duration:
            break
        end = min(end, duration)
        v2 = _label_to_v2(lab)
        sections.append(
            {
                "label": v2,
                "start_eight": idx * 2,
                "end_eight": idx * 2 + 2,
                "start_time": start,
                "end_time": end,
                "cluster_id": idx,
                "mean_energy": 0.85 if v2 == "CHORUS" else 0.45,
                "energy_trend": 0.0,
                "repeat_count": 1,
                "confidence": 0.92,
            }
        )
        change_points.append(
            {
                "time": start,
                "eight_index": idx * 2,
                "type": "CHORUS_START" if v2 == "CHORUS" else v2,
                "is_major": v2 in ("CHORUS", "INTRO", "OUTRO"),
                "confidence": 0.92,
                "note": "all-in-one-mock",
            }
        )

    return {
        "bpm": bpm,
        "duration": duration,
        "eight_times": downbeats,
        "sections": sections,
        "change_points": change_points,
        "beats": beats,
        "downbeats": downbeats,
        "source": "all-in-one-mock",
        "analyzer_version": AIO_VERSION,
        "analyzer_path": "api/v2/analyze-structure-aio",
    }


def _parse_allin1_json(data: dict[str, Any]) -> dict[str, Any] | None:
    """allin1 出力 JSON → StructureResultV2 互換。"""
    segments = data.get("segments") or data.get("sections") or []
    if not isinstance(segments, list) or len(segments) == 0:
        return None

    parsed_segs: list[dict[str, Any]] = []
    for s in segments:
        if not isinstance(s, dict):
            continue
        start = float(s.get("start", 0))
        end = float(s.get("end", 0))
        label = str(s.get("label", "verse"))
        if end <= start:
            continue
        parsed_segs.append({"start": start, "end": end, "label": label})
    if not parsed_segs:
        return None

    beats = [float(x) for x in (data.get("beats") or []) if _finite(x)]
    downbeats = [float(x) for x in (data.get("downbeats") or []) if _finite(x)]
    bpm = float(data.get("bpm") or 120)
    duration = float(
        data.get("duration")
        or max(
            (parsed_segs[-1]["end"] if parsed_segs else 0),
            (max(beats) if beats else 0),
            (max(downbeats) if downbeats else 0),
            1.0,
        )
    )

    eight_times = sorted(downbeats) if downbeats else [b for i, b in enumerate(beats) if i % 8 == 0]

    sections = []
    change_points = []
    for idx, seg in enumerate(parsed_segs):
        v2 = _label_to_v2(seg["label"])
        start_eight = next(
            (i for i, t in enumerate(eight_times) if t >= seg["start"] - 1e-3),
            idx,
        )
        end_eight = next(
            (i for i, t in enumerate(eight_times) if t >= seg["end"] - 1e-3),
            start_eight + 1,
        )
        sections.append(
            {
                "label": v2,
                "start_eight": start_eight,
                "end_eight": max(end_eight, start_eight + 1),
                "start_time": seg["start"],
                "end_time": min(duration, seg["end"]),
                "cluster_id": idx,
                "mean_energy": 0.85 if v2 == "CHORUS" else 0.45,
                "energy_trend": 0.0,
                "repeat_count": 1,
                "confidence": 0.9,
            }
        )
        change_points.append(
            {
                "time": seg["start"],
                "eight_index": start_eight,
                "type": "CHORUS_START" if v2 == "CHORUS" else v2,
                "is_major": v2 in ("CHORUS", "INTRO", "OUTRO"),
                "confidence": 0.9,
                "note": "all-in-one",
            }
        )

    return {
        "bpm": bpm,
        "duration": duration,
        "eight_times": eight_times,
        "sections": sections,
        "change_points": change_points,
        "beats": beats,
        "downbeats": downbeats,
        "source": AIO_SOURCE,
        "analyzer_version": AIO_VERSION,
        "analyzer_path": "api/v2/analyze-structure-aio",
    }


def _finite(x: Any) -> bool:
    try:
        float(x)
        return True
    except (TypeError, ValueError):
        return False


def _extract_json_from_replicate_output(output: Any, token: str) -> dict[str, Any] | None:
    """
    Replicate の output は JSON ファイル URI のリスト、または単一 URI、または dict。
    """
    if isinstance(output, dict) and (
        "segments" in output or "beats" in output or "sections" in output
    ):
        return output

    uris: list[str] = []
    if isinstance(output, str):
        uris = [output]
    elif isinstance(output, list):
        uris = [u for u in output if isinstance(u, str)]

    headers = {"Authorization": f"Token {token}"}
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        for uri in uris:
            if not uri.lower().endswith(".json") and "json" not in uri.lower():
                # 拡張子が無くても試す（最後の手段）
                pass
            try:
                r = client.get(uri, headers=headers)
                if not r.is_success:
                    continue
                ctype = r.headers.get("content-type", "")
                if "json" in ctype or uri.lower().endswith(".json"):
                    data = r.json()
                    if isinstance(data, dict):
                        return data
            except Exception:  # noqa: BLE001
                continue

        # JSON 以外しか無い場合、全 URI を試す
        for uri in uris:
            try:
                r = client.get(uri, headers=headers)
                if not r.is_success:
                    continue
                text = r.text.lstrip()
                if text.startswith("{"):
                    data = json.loads(text)
                    if isinstance(data, dict):
                        return data
            except Exception:  # noqa: BLE001
                continue
    return None


def analyze_with_replicate(audio_url: str, *, demux: bool = False) -> dict[str, Any] | None:
    """
    Replicate で All-In-One を実行し StructureResultV2 互換 dict を返す。
    失敗時は None。
    """
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        return None

    # モデル最新 predictions API（owner/name）
    create_url = f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions"
    headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "music_input": audio_url,
            "visualize": False,
            "sonify": False,
            "activ": False,
            "embed": False,
            "model": "harmonix-all",
        }
    }
    # cwalo fork は demux 対応
    if demux and "cwalo" in REPLICATE_MODEL:
        payload["input"]["demux"] = True

    with httpx.Client(timeout=300.0, follow_redirects=True) as client:
        res = client.post(create_url, headers=headers, json=payload)
        if res.status_code == 404:
            ver = os.environ.get("REPLICATE_AIO_VERSION", "").strip()
            if not ver:
                return None
            res = client.post(
                "https://api.replicate.com/v1/predictions",
                headers=headers,
                json={"version": ver, "input": payload["input"]},
            )
        if not res.is_success:
            return None

        pred = res.json()
        # Prefer: wait でも処理中のことがある
        status = pred.get("status")
        get_url = pred.get("urls", {}).get("get") or f"https://api.replicate.com/v1/predictions/{pred.get('id')}"
        deadline = time.time() + 240
        while status in ("starting", "processing") and time.time() < deadline:
            time.sleep(2.0)
            poll = client.get(get_url, headers={"Authorization": f"Token {token}"})
            if not poll.is_success:
                break
            pred = poll.json()
            status = pred.get("status")

        if status != "succeeded":
            return None

        raw_json = _extract_json_from_replicate_output(pred.get("output"), token)
        if not raw_json:
            return None
        return _parse_allin1_json(raw_json)


def analyze_structure_aio(
    audio_url: str,
    *,
    duration_hint: float | None = None,
    force_mock: bool | None = None,
) -> dict[str, Any] | None:
    """
    エントリポイント。
    REPLICATE_AIO_MOCK=1 → モック。
    トークン無し → None（呼び出し側で chroma-SSM にフォールバック）。
    Replicate 失敗 → None。
    """
    mock_flag = force_mock
    if mock_flag is None:
        mock_flag = os.environ.get("REPLICATE_AIO_MOCK", "").strip() in (
            "1",
            "true",
            "TRUE",
            "yes",
        )

    if mock_flag:
        return mock_all_in_one_structure(
            duration=float(duration_hint or 96.0),
        )

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        return None

    return analyze_with_replicate(audio_url)

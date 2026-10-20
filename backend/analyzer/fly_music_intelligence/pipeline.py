"""
FLY pipeline 司令塔（Phase 1–3）。

既存 All-In-One → chroma-SSM フォールバックをここに集約する。
レスポンス形は StructureResultV2 互換のまま（Formation Engine 非破壊）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from services.all_in_one_structure import AIO_VERSION, analyze_structure_aio
from services.song_structure_v2 import STRUCTURE_V2_VERSION, analyze_structure

from .versions import FUSION_VERSION, version_bundle


def attach_fly_meta(result: dict[str, Any], *, source: str) -> dict[str, Any]:
    """既存 StructureResultV2 dict に FLY メタを追加（未知フィールドはクライアントが無視可）。"""
    out = dict(result)
    out["fly"] = {
        **version_bundle(),
        "pipeline": "fly_music_intelligence.v0",
        "structure_source": source,
        "ensemble": {
            "essentia": False,
            "librosa": True,
            "madmom": False,
            "msaf": False,
            "cyanite": False,
            "all_in_one": source == "all-in-one",
        },
        "fusion_version": FUSION_VERSION,
        "structure_v2_version": STRUCTURE_V2_VERSION,
        "aio_version": AIO_VERSION,
    }
    return out


def analyze_structure_fly(
    audio_url: str,
    *,
    duration_hint: float | None = None,
    download_to_temp: Callable[[str], Path] | None = None,
) -> dict[str, Any]:
    """
    FLY 統合エントリ。
    1) All-In-One（URL）
    2) chroma-SSM（ローカルファイル）— download_to_temp 必須
    """
    aio = analyze_structure_aio(audio_url, duration_hint=duration_hint)
    if aio is not None and aio.get("sections"):
        return attach_fly_meta(aio, source="all-in-one")

    if download_to_temp is None:
        raise RuntimeError("download_to_temp required for chroma-SSM fallback")

    tmp_path = download_to_temp(audio_url)
    try:
        result = analyze_structure(str(tmp_path))
        if not result.get("source"):
            result["source"] = "fly_song_structure_v2"
        result.setdefault("analyzer_path", "fly_music_intelligence")
        return attach_fly_meta(result, source="chroma-ssm")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

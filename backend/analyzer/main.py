"""
ChoreoCore 純アルゴリズム版 — 音源解析 FastAPI

- POST /analyze                     … 既存 v1（ブロック RMS + section_families）
- POST /api/v2/analyze-structure    … All-In-One(Replicate) 優先 → chroma-SSM フォールバック
- POST /api/v2/analyze-structure-aio … All-In-One のみ（モック可）
- POST /analyze-structure           … analyze-structure のエイリアス
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.audio_analyzer import ANALYZER_VERSION, analyze_track
from services.song_structure_v2 import (
    STRUCTURE_V2_VERSION,
    analyze_structure,
)
from services.all_in_one_structure import (
    AIO_VERSION,
    analyze_structure_aio,
)
from fly_music_intelligence.pipeline import attach_fly_meta
from fly_music_intelligence.versions import version_bundle

app = FastAPI(
    title="ChoreoCore FLY Music Intelligence",
    version=ANALYZER_VERSION,
    description="FLY Dance Music Intelligence（All-In-One / chroma-SSM / librosa）",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    audio_url: str = Field(..., description="公開可能な音源URL (mp3/wav/m4a)")
    audio_hash: str | None = Field(None, description="任意: SHA256 などキャッシュキー")
    duration_hint: float | None = Field(
        None, description="モック AIO 用の尺ヒント（秒）"
    )


def _suffix_from_url(audio_url: str) -> str:
    lower = audio_url.lower()
    if ".wav" in lower:
        return ".wav"
    if ".m4a" in lower or ".aac" in lower:
        return ".m4a"
    return ".mp3"


async def _download_audio_to_temp(audio_url: str) -> Path:
    suffix = _suffix_from_url(audio_url)
    async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
        resp = await client.get(audio_url)
        resp.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            tmp.write(resp.content)
            tmp.flush()
        finally:
            tmp.close()
        return Path(tmp.name)


@app.get("/health")
async def health():
    has_replicate = bool(os.environ.get("REPLICATE_API_TOKEN", "").strip())
    aio_mock = os.environ.get("REPLICATE_AIO_MOCK", "").strip() in (
        "1",
        "true",
        "TRUE",
        "yes",
    )
    return {
        "ok": True,
        "version": ANALYZER_VERSION,
        "structure_v2_version": STRUCTURE_V2_VERSION,
        "all_in_one_version": AIO_VERSION,
        "fly": version_bundle(),
        "all_in_one_ready": has_replicate or aio_mock,
        "endpoints": [
            "/analyze",
            "/api/v2/analyze-structure",
            "/api/v2/analyze-structure-aio",
            "/analyze-structure",
        ],
    }


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    tmp_path: Path | None = None
    try:
        tmp_path = await _download_audio_to_temp(req.audio_url)
        result = analyze_track(str(tmp_path))
        if req.audio_hash:
            result["audio_hash"] = req.audio_hash
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


@app.post("/api/v2/analyze-structure-aio")
async def analyze_structure_aio_route(req: AnalyzeRequest):
    """
    All-In-One（Replicate）専用。トークン無しかつ MOCK 無しなら 503。
    """
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    result = analyze_structure_aio(
        req.audio_url,
        duration_hint=req.duration_hint,
    )
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="All-In-One unavailable (set REPLICATE_API_TOKEN or REPLICATE_AIO_MOCK=1)",
        )
    if req.audio_hash:
        result["audio_hash"] = req.audio_hash
    return result


@app.post("/api/v2/analyze-structure")
@app.post("/analyze-structure")
async def analyze_structure_v2(req: AnalyzeRequest):
    """
    FLY 司令塔: All-In-One → chroma-SSM。StructureResultV2 互換 + fly メタ。
    """
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    aio = analyze_structure_aio(
        req.audio_url,
        duration_hint=req.duration_hint,
    )
    if aio is not None and aio.get("sections"):
        result = attach_fly_meta(aio, source="all-in-one")
        if req.audio_hash:
            result["audio_hash"] = req.audio_hash
        return result

    tmp_path: Path | None = None
    try:
        tmp_path = await _download_audio_to_temp(req.audio_url)
        raw = analyze_structure(str(tmp_path))
        if not raw.get("source"):
            raw["source"] = "fly_song_structure_v2"
        raw.setdefault("analyzer_path", "api/v2/analyze-structure")
        result = attach_fly_meta(raw, source="chroma-ssm")
        if req.audio_hash:
            result["audio_hash"] = req.audio_hash
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

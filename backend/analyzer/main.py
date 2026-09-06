"""
ChoreoCore 純アルゴリズム版 — 音源解析 FastAPI

- POST /analyze                     … 既存 v1（ブロック RMS + section_families）
- POST /api/v2/analyze-structure    … song_structure_v2（chroma-SSM / StructureResultV2）
- POST /analyze-structure           … 上記のエイリアス
"""

from __future__ import annotations

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

app = FastAPI(
    title="ChoreoCore Song Analyzer",
    version=ANALYZER_VERSION,
    description="LLMなし・librosaによる楽曲構造解析（v1 + chroma-SSM v2）",
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
    return {
        "ok": True,
        "version": ANALYZER_VERSION,
        "structure_v2_version": STRUCTURE_V2_VERSION,
        "endpoints": [
            "/analyze",
            "/api/v2/analyze-structure",
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


@app.post("/api/v2/analyze-structure")
@app.post("/analyze-structure")
async def analyze_structure_v2(req: AnalyzeRequest):
    """
    song_structure_v2.py による StructureResultV2 互換 JSON。
    フロントの EngineAppSuggestInput.structureV2 にそのまま渡せる形。
    """
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    tmp_path: Path | None = None
    try:
        tmp_path = await _download_audio_to_temp(req.audio_url)
        result = analyze_structure(str(tmp_path))
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

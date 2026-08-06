"""
ChoreoCore 純アルゴリズム版 — 音源解析 FastAPI
POST /analyze { "audio_url": "..." }
"""

from __future__ import annotations

import tempfile

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.audio_analyzer import ANALYZER_VERSION, analyze_track

app = FastAPI(
    title="ChoreoCore Song Analyzer",
    version=ANALYZER_VERSION,
    description="LLMなし・librosaによる楽曲構造解析",
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


@app.get("/health")
async def health():
    return {"ok": True, "version": ANALYZER_VERSION}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    suffix = ".mp3"
    lower = req.audio_url.lower()
    if ".wav" in lower:
        suffix = ".wav"
    elif ".m4a" in lower or ".aac" in lower:
        suffix = ".m4a"

    try:
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
            resp = await client.get(req.audio_url)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
                tmp.write(resp.content)
                tmp.flush()
                result = analyze_track(tmp.name)
        if req.audio_hash:
            result["audio_hash"] = req.audio_hash
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e

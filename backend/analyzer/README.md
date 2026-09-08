# Song analyzer (Fly.io)

## Local

```bash
cd backend/analyzer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | liveness + versions + All-In-One ready |
| POST | `/analyze` | v1 RMS blocks + `section_families` |
| POST | `/api/v2/analyze-structure` | **All-In-One 優先** → chroma-SSM フォールバック |
| POST | `/api/v2/analyze-structure-aio` | All-In-One のみ（Replicate / mock） |
| POST | `/analyze-structure` | alias of v2 |

### All-In-One（Replicate）

Fly secrets:

```bash
fly secrets set REPLICATE_API_TOKEN=r8_... -a choreocore-song-analyzer
# 任意
fly secrets set REPLICATE_AIO_MODEL=sakemin/all-in-one-music-structure-analyzer -a choreocore-song-analyzer
# ローカル開発（Replicate 無し）
fly secrets set REPLICATE_AIO_MOCK=1 -a choreocore-song-analyzer
```

成功時の `structure_v2` には `beats` / `downbeats`（秒）が含まれ、フロントの 8カウントグリッドは AI ダウンビートを優先する。


### v2 request

```json
{ "audio_url": "https://…/track.mp3", "audio_hash": "optional" }
```

### v2 response (`StructureResultV2`)

```json
{
  "bpm": 120.0,
  "duration": 64.0,
  "eight_times": [0.0, 4.0, …],
  "sections": [
    {
      "label": "CHORUS",
      "start_eight": 4,
      "end_eight": 8,
      "start_time": 16.0,
      "end_time": 32.0,
      "cluster_id": 2,
      "mean_energy": 0.81,
      "energy_trend": 0.002,
      "repeat_count": 2,
      "confidence": 0.75
    }
  ],
  "change_points": [
    {
      "time": 16.0,
      "eight_index": 4,
      "type": "CHORUS_START",
      "is_major": true,
      "confidence": 0.75,
      "note": ""
    }
  ],
  "source": "chroma-ssm-v2",
  "analyzer_version": "structure-v2.0.0"
}
```

Wire this JSON into the app as `EngineAppSuggestInput.structureV2`.

## Deploy

```bash
cd backend/analyzer
fly deploy
```

## Tests

```bash
cd backend/analyzer
pytest -q
```

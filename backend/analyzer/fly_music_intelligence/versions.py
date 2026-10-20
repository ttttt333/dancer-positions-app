"""
FLY Music Intelligence — version bundle (Dance Music Intelligence Engine).

既存 services.* の定数と揃え、キャッシュ無効化は analyzer_version で行う。
"""

from __future__ import annotations

# 既存 v1 キャッシュキー（Edge / client と同期）
ANALYZER_VERSION = "algo-v1.5.0"
STRUCTURE_V2_VERSION = "structure-v2.0.1"
AIO_VERSION = "all-in-one-v1.0.0"

FUSION_VERSION = "fly-fusion-v0.1.0"
DANCE_MODEL_VERSION = "fly-dance-v0.1.0"
FORMATION_MODEL_VERSION = "choreocore-tier1-v5"


def version_bundle() -> dict[str, str]:
    return {
        "analyzer_version": ANALYZER_VERSION,
        "structure_v2_version": STRUCTURE_V2_VERSION,
        "aio_version": AIO_VERSION,
        "fusion_version": FUSION_VERSION,
        "dance_model_version": DANCE_MODEL_VERSION,
        "formation_model_version": FORMATION_MODEL_VERSION,
    }

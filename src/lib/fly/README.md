# FLY Music Intelligence Engine

ChoreoCore の楽曲解析を **Dance Music Intelligence Engine** として進化させるレイヤ。

## 設計原則

1. **既存 Formation Engine を壊さない** — 入力は引き続き `StructureResultV2` + change points
2. **Ensemble** — 1アルゴリズムを真実としない（Essentia / madmom / MSAF / Cyanite は段階追加）
3. **外部 API は OPTIONAL** — 落ちてもローカル解析で degraded 動作
4. **confidence 必須** — 分からないときは `unknown` / 低 confidence
5. **Adapter → Normalized → Fusion → Formation** — 解析器を Formation に直結しない

## Phase 進捗

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 既存監査 + 抽象化 | ✅ `src/lib/fly/` |
| 2 | 現行結果の FLY 契約投影 | ✅ `fromStructureV2` / `toStructureV2` |
| 3 | Fusion 入口（パススルー Ensemble） | ✅ `fusion.ts` / `client.ts` |
| 4 | Essentia adapter + multi-analyzer Fusion 基盤 | ✅ `adapters/` / `fusionMulti.ts` |
| **4.5** | **FLY Benchmark / Ground Truth**（解析器の得意分野マップ） | ⏳ next |
| 5 | Beat Ensemble (madmom 等) | ⏳ after 4.5 |
| 6 | Structure Ensemble (MSAF+) | ⏳ |
| 7 | Energy / Impact | ⏳ |
| 8 | Music Events 強化 | ⏳ |
| 9 | Dance Intelligence 本実装 | ⏳ |
| 10 | Formation Music Fit + KEEP_CURRENT | ⏳ |
| 11 | Analysis Lab UI | ⏳ |
| 12 | Human Annotation + Feedback Dataset | ⏳ |

## Phase 4 経路

```
Essentia (optional, flag OFF by default)
   ↓
Essentia Adapter → FLY normalized
   ↓
FLY Fusion (multi analyzer + provenance)
   ↓
StructureResultV2 (compatible)
   ↓
Formation Engine（既存・非破壊）
```

Feature flag: `VITE_FLY_ESSENTIA_ENABLED` (default `false`).  
Docs: `docs/fly/PHASE4-AUDIT.md`, `docs/fly/PHASE4-BENCHMARK.md`.

## 使い方

```ts
import { analyzeSongWithFly, fuseAnalyzerResults } from "../lib/fly";

const { fly, structureV2, remote, fusion } = await analyzeSongWithFly({
  audioUrl,
  audioSupabasePath,
  // optional PCM + flag → Essentia joins Fusion (not Formation directly)
  // audioPcm: { samples, sampleRate, channels, durationSeconds },
});

// Formation Engine へは従来どおり
// runEngineAppSuggest({ structureV2, remoteChangePoints: remote?.change_points, ... })
```

## Backend

`backend/analyzer/fly_music_intelligence/` — バージョン定数とパイプライン司令塔の骨組み。
既存 `/api/v2/analyze-structure` のレスポンス形は維持。

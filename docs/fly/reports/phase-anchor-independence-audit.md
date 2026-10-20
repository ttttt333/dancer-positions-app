# PHASE 4.6-F — Phase Anchor Independence Audit

**Status:** COMPLETE
**Verdict:** **A — CONDITIONAL-GO**
**Ran:** 2026-09-14T03:55:07.899192+00:00

**Sole question:** Was an independent observation discovered that justifies existing L3 — **not** Analyzer accuracy?

## Verdict

### A — CONDITIONAL-GO → 追加 Pilot → その後 GO（L3モデル設計）

- 4/5 primary Anchors FAR from Beat0/CountGrid origin
- 0/5 rationales use Beat/CountGrid/Analyzer copy lexicon
- primary types: ['SECTION', 'SECTION', 'SECTION', 'VOCAL', 'VOCAL'] (not BEAT/DOWNBEAT-only)
- 013 center case: Anchor ≠ Beat0/CountGrid; SECTION + body rationale

### Caveats（重要）

- 013 is ON a later Beat-grid pulse (not off-grid microtiming) — independence is from origin/phase0, not from pulse quantization
- 5/5 share similar rationale template (section/vocal entry → count1) — kinds discovery still narrow; expand types in extra Pilot
- Beat GT seeds sparse/out-of-range for ['song-020', 'song-009', 'song-005'] — nearest-seed distance not used; residual uses beat0+bpm/interval grid
- Dense GT check on **013**: nearest annotated beat ≈31.448s（Δ≈**0.029s**）→ 踊りの原点は **後続の拍格子上**であり、Beat0/CountGrid ではない。

## Axis 1 — Independence

| song | Anchor | type | Beat0 | CountGrid | ΔBeat0 | ΔCG | gridResid | vsOrigin | vsGrid | class |
|------|--------|------|-------|-----------|--------|-----|-----------|----------|--------|-------|
| 013 | 31.419 | SECTION | 0.287 | 0.287 | 31.132 | 31.132 | 0.215 | FAR_FROM_ORIGIN | SOFT_ON_BEAT_GRID | `FAR_FROM_ORIGIN_ON_LATER_GRID` |
| 020 | 33.080 | SECTION | 5.499 | 5.499 | 27.581 | 27.581 | 0.081 | FAR_FROM_ORIGIN | SOFT_ON_BEAT_GRID | `FAR_FROM_ORIGIN_ON_LATER_GRID` |
| 009 | 34.700 | SECTION | 13.221 | 13.218 | 21.479 | 21.482 | 0.282 | FAR_FROM_ORIGIN | ON_HALF_BEAT | `FAR_FROM_ORIGIN_OFF_OR_HALF_GRID` |
| 005 | 13.190 | VOCAL | 0.506 | 0.506 | 12.684 | 12.684 | 0.073 | FAR_FROM_ORIGIN | ON_BEAT_GRID | `FAR_FROM_ORIGIN_ON_LATER_GRID` |
| 002 | 2.437 | VOCAL | 2.554 | 2.528 | 0.117 | 0.091 | 0.117 | SOFT_NEAR_BEAT0 | SOFT_ON_BEAT_GRID | `TIME_NEAR_ORIGIN_REASON_INDEPENDENT` |

**読み:** L2原点（Beat0≈CountGrid）からの独立は **4/5 で明確**。002は原点近傍だが rationale は VOCAL／身体語でコピーではない。

多くの Anchor は「パルス格子の外」ではなく、「**どの拍／どの区間を踊りの原点にするか**」が L2原点と違う、という形の独立情報である。

## Axis 2 — Reproducibility

- 二重注釈: **未実施**（単一 annotator）
- confidence: 全曲 **0.7**
- 共有ルール: 区間変化／歌声入り → カウント1で合わせ開始
- 判定: 議論可能な安定感はあるが、**再現性は未証明** → 追加 Pilot で二重注釈が次

## Axis 3 — Anchor kinds

- Inventory: `{'SECTION': 4, 'HIT': 1, 'VOCAL': 2}`
- Primary: ['SECTION', 'SECTION', 'SECTION', 'VOCAL', 'VOCAL']
- BEAT/DOWNBEAT への崩壊なし。SECTION/VOCAL が主。HIT は 013 の追加のみ。

## Axis 4 — Rationale consistency

- Beat-copy lexicon: **0/5**
- Body/section lexicon: **5/5**
- 共通構造: `musical change / vocal entry → ensemble count1 start`
- テンプレ再利用: **5/5**（種類発見はまだ狭い）

### Center: song-013

- Anchor **31.419s** vs Beat0/CountGrid **0.287s**（Δ≈**31.1s**）
- type `SECTION`
- rationale: イントロ後、ビートの質が変わって動き出しやすくなる境。ここを起点にカウント1から全体で前に移動し始める。
- Beat番号 / CountGrid / Analyzer なしで説明できている ✅

## Next

- Extra Pilot: double-annotate at least 013 (+1–2 more) for reproducibility
- Optional expand types (HIT/GROOVE/ANTICIPATION) if they appear
- Then GO for L3 Dance Phase data model design
- Still freeze Fusion/MSAF/Analyzer retargeting

## Contract

> 4.6-F judges whether Phase Anchor is independent observation — not whether Analyzers got more accurate.

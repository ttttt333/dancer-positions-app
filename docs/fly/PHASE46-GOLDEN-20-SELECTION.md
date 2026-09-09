# FLY Phase 4.6 — Golden 20 Selection

**Status:** FINALIZE (titles locked) — audio local normalize in progress  
**Phase:** FLY Phase 4.6 Real-Song Ground Truth  
**Purpose:** Human-first Ground Truth Dataset construction  
**Scope:** Golden 20 songs  
**Last Updated:** 2026-09-09  

Local analyze-ready copies: `~/ChoreoCoreDatasets/fly-real-song/` (see `fixtures/fly/real-song/LOCAL_AUDIO.md`).  
**20/20** audio hashed + mono WAV ready (009 replaced 2026-09-09).

---

## Constitution (Phase 4.6)

> **Measure first. Improve later.**  
> **Human first. Analyzer second.**  
> **Evidence before architecture.**

---

## 1. Purpose

FLY Phase 4.6では、実在楽曲を対象とした Human-first Ground Truth Dataset を構築する。

本工程の目的は、

> 「どの Analyzer が優れているかを先に決めること」

ではない。

人間による独立した Ground Truth を構築し、

- Beat  
- Downbeat  
- Section  
- 8-count  
- Musical Change  

について、次の評価ループを成立させることである。

```text
Human Ground Truth
        ↓
Benchmark
        ↓
librosa / Essentia
        ↓
Weakness Detection
```

---

## 2. Phase 4.6 Core Principle

### Human-first

Human Annotation は、Analyzer の出力を見ずに実施する。

**禁止：**

```text
Analyzer
   ↓
Human correction
   ↓
Ground Truth
```

**採用：**

```text
Audio
   ↓
Human listening / annotation
   ↓
Ground Truth
   ↓
Analyzer comparison
```

Ground Truth は Analyzer に合わせて修正してはならない。

---

## 3. Golden 20 Selection Principle

Golden 20 は、単純に「有名な曲」を集めるものではない。

FLY が将来的にダンス用途で扱う可能性が高い条件をできるだけカバーする。

**評価対象条件：**

J-POP / K-POP / Hip-Hop / EDM / Funk / R&B / Ballad / Instrumental /  
Vocal-heavy / Strong groove / Syncopation / Drop / Break /  
Complex structure / Stable structure / Repetitive structure /  
Slow / Fast / High energy / Low energy / Rhythmic change / Section change  

---

## 4. Golden 20

| ID | Title | Artist | Genre | Primary Condition | Secondary Condition | Double Annotation | Status |
|----|-------|--------|-------|-------------------|---------------------|-------------------|--------|
| 001 | アイドル | YOASOBI | J-POP | Vocal / Pop Structure | High Energy | NO | SELECTED |
| 002 | ダンスホール | Mrs. GREEN APPLE | J-POP | Groove | Section / Vocal | **YES** | SELECTED |
| 003 | 唱 | Ado | J-POP | Complex Rhythm | High Energy / Change | NO | SELECTED |
| 004 | ポリリズム | Perfume | J-POP / Electronic | Repetition | Electronic / Groove | NO | SELECTED |
| 005 | Super Shy | NewJeans | K-POP | Groove | Repetition / Vocal | **YES** | SELECTED |
| 006 | MIC Drop | BTS | K-POP / Hip-Hop | Strong Beat | Rap / Groove | NO | SELECTED |
| 007 | How You Like That | BLACKPINK | K-POP | Energy Change | Drop / Impact | NO | SELECTED |
| 008 | God's Menu | Stray Kids | K-POP / Hip-Hop | Aggressive Rhythm | Change / Impact | NO | SELECTED |
| 009 | Get Ur Freak On | Missy Elliott | Hip-Hop | Syncopation | Groove / Rhythm | NO | SELECTED |
| 010 | Still D.R.E. | Dr. Dre feat. Snoop Dogg | Hip-Hop | Stable Groove | Repetition | **YES** | SELECTED |
| 011 | HUMBLE. | Kendrick Lamar | Hip-Hop | Rhythmic Density | Rap / Groove | NO | SELECTED |
| 012 | SICKO MODE | Travis Scott | Hip-Hop | Complex Structure | Major Changes / Tempo-related Change | NO | SELECTED |
| 013 | One More Time | Daft Punk | EDM / Electronic | Four-on-the-floor | Repetition / Build | **YES** | SELECTED |
| 014 | Omen | The Prodigy | EDM | High Energy | Aggressive / Impact | NO | SELECTED |
| 015 | Bangarang | Skrillex | EDM | Drop | High Energy / Impact | NO | SELECTED |
| 016 | 24K Magic | Bruno Mars | Funk / Pop | Groove | Funk / Vocal | NO | SELECTED |
| 017 | Billie Jean | Michael Jackson | Pop / Funk | Stable Groove | Repetition / Bass | NO | SELECTED |
| 018 | Thinkin Bout You | Frank Ocean | R&B | Slow / Vocal | Low Energy / Dynamic Change | NO | SELECTED |
| 019 | カタオモイ | Aimer | J-POP / Ballad | Slow | Vocal / Dynamic Change | NO | SELECTED |
| 020 | Cornfield Chase | Hans Zimmer | Instrumental / Cinematic | Instrumental | Dynamic / Cinematic Build | NO | SELECTED |

---

## 5. Selection Rationale

### 001 — アイドル / YOASOBI

**Purpose:** J-POP代表 / Vocal-driven / Section transitions / High energy / Modern pop  

**Expected evaluation:** Beat, Section, 8-count, Musical Change  

### 002 — ダンスホール / Mrs. GREEN APPLE

**Purpose:** Modern J-POP / Strong danceable groove / Vocal-driven / Section transitions  

**Double Annotation 対象。**

### 003 — 唱 / Ado

**Purpose:** Dense rhythmic information / Complex vocal rhythm / Strong energy changes / Dance-oriented impact  

**Stress test:** Beat, Section, Musical Change  

### 004 — ポリリズム / Perfume

**Purpose:** Electronic repetition / Stable rhythmic structure / Repetitive sections  

Analyzer が安定して Beat を追えるかを確認する基準曲。

### 005 — Super Shy / NewJeans

**Purpose:** K-POP / Strong groove / Repetitive structure / Vocal-driven  

**Double Annotation 対象。**

### 006 — MIC Drop / BTS

**Purpose:** K-POP + Hip-Hop / Strong beat / Rap-driven sections / Stable groove  

### 007 — How You Like That / BLACKPINK

**Purpose:** Energy contrast / Build–release / Drop-like impact / K-POP structure  

### 008 — God's Menu / Stray Kids

**Purpose:** Aggressive rhythm / High energy / Rapid changes / K-POP–Hip-Hop hybrid  

Section / Beat stress test。

### 009 — Get Ur Freak On / Missy Elliott

**Purpose:** Syncopated rhythm / Hip-Hop groove / Rhythmic ambiguity  

Beat tracking stress test。

### 010 — Still D.R.E. / Dr. Dre feat. Snoop Dogg

**Purpose:** Stable groove / Highly repetitive pulse  

Analyzer の基準曲。**Double Annotation 対象。**

### 011 — HUMBLE. / Kendrick Lamar

**Purpose:** Dense rap rhythm / Strong beat / Hip-Hop structure  

Beat / onset stress test。

### 012 — SICKO MODE / Travis Scott

**Purpose:** Complex structure / Multiple sections / Major arrangement changes / Tempo-related variation  

Golden 20 の重要な Complex Structure test case。

### 013 — One More Time / Daft Punk

**Purpose:** Four-on-the-floor / Repetition / Build–release  

**Double Annotation 対象。**

### 014 — Omen / The Prodigy

**Purpose:** High energy / Aggressive electronic rhythm / Strong impact  

### 015 — Bangarang / Skrillex

**Purpose:** Drop / Extreme energy change / Strong impact  

Musical Change detection の重要ケース。

### 016 — 24K Magic / Bruno Mars

**Purpose:** Funk groove / Bass–drum relationship / Dance-oriented rhythm  

### 017 — Billie Jean / Michael Jackson

**Purpose:** Stable groove / Strong bass / Classic dance structure  

Beat / groove の基準曲。

### 018 — Thinkin Bout You / Frank Ocean

**Purpose:** R&B / Slow / Vocal-heavy / Dynamic structure  

Slow / low-density condition。

### 019 — カタオモイ / Aimer

**Purpose:** Ballad / Slow / Vocal-driven / Lower rhythmic density  

Slow tempo / section detection。

### 020 — Cornfield Chase / Hans Zimmer

**Purpose:** Instrumental / No conventional pop vocal structure / Cinematic build  

Vocal-dependent でないかを確認する stress test。

---

## 6. Coverage Matrix

| Condition | Target Songs |
|-----------|--------------|
| J-POP | 001, 002, 003, 004, 019 |
| K-POP | 005, 006, 007, 008 |
| Hip-Hop | 006, 009, 010, 011, 012 |
| EDM / Electronic | 004, 013, 014, 015 |
| Funk | 016, 017 |
| R&B | 018 |
| Ballad | 019 |
| Instrumental | 020 |
| Complex Structure | 003, 008, 012, 015, 020 |
| Stable Groove | 010, 013, 017 |
| Syncopation | 009, 011 |
| Drop / Impact | 007, 008, 014, 015 |
| Slow | 018, 019 |
| High Energy | 001, 003, 007, 008, 014, 015 |
| Vocal Heavy | 001, 002, 003, 005, 018, 019 |
| Repetition | 004, 005, 010, 013, 017 |
| Dynamic Change | 007, 012, 015, 018, 019, 020 |

---

## 7. Double Annotation Set

| ID | Title | Why |
|----|-------|-----|
| **002** | ダンスホール | J-POP |
| **005** | Super Shy | K-POP |
| **010** | Still D.R.E. | Hip-Hop |
| **013** | One More Time | EDM |

```text
Annotator A
      +
Annotator B
      ↓
Agreement
      ↓
Consensus
```

---

## 8. Annotation Targets

各楽曲について Human-first で以下を作成する。

### 8.1 Beat

Beat timestamp を記録する。

```text
beat = [ 0.512, 1.021, 1.523, ... ]
```

### 8.2 Downbeat

Bar の開始位置を記録する。Analyzer 推定を基準にしてはいけない。

```text
downbeat = [ 0.512, 2.521, 4.532, ... ]
```

### 8.3 Section

例: INTRO / VERSE / PRE_CHORUS / CHORUS / BRIDGE / BREAK / DROP / OUTRO  

名称が曖昧な場合は Annotation SOP に従い一貫したラベルを使う。

詳細操作: [`PHASE46-ANNOTATION-SOP.md`](./PHASE46-ANNOTATION-SOP.md)

---

## 9. 8-count

Beat / Downbeat を基準に、ダンス用途の 8-count を作成する。

重要: 単純な 4/4 仮定の自動生成ではなく、**Human GT の Beat / Downbeat から構築**する。

---

## 10. Musical Change

Formation 変更そのものは Annotation しない。

記録するのは **「音楽的に大きな変化が発生したか」** のみ。

基本 strength: **HIGH**（必要に応じて MEDIUM / LOW — SOP 参照）

**Reasons（本 Selection 文書の語彙）:**

- `ENERGY_SPIKE`
- `DROP`
- `BREAK`
- `NEW_SECTION`
- `DENSITY_CHANGE`
- `VOCAL_CHANGE`
- `RHYTHMIC_CHANGE`
- `ARRANGEMENT_CHANGE`

例:

```json
{
  "level": "HIGH",
  "reasons": ["ENERGY_SPIKE", "NEW_SECTION"]
}
```

> Schema 実装時は既存 `MusicalChange` 型へマッピングする（FINALIZE 後の manifest 更新時）。  
> `musical_change` ≠ `formation_change`

---

## 11. Formation Recommendation は禁止

Phase 4.6 では以下を Annotation **しない**。

- FORMATION_CHANGE / FORMATION_TYPE  
- MOVE_LEFT / MOVE_RIGHT / CROSSING  
- TRAVEL_DISTANCE / POSITION_CHANGE  

理由: Phase 4.6 は **Music Understanding** GT であり、Formation Recommendation GT ではない。

---

## 12. Source Policy

各楽曲の Source は、解析に使用する音源の正当な利用権限を確認したうえで登録する。

未確定の場合: `PENDING_AUTHORIZED_SOURCE`

**禁止:**

- 無許可ダウンロード  
- 出所不明  
- YouTube 等からの無断取得  
- 権利関係が不明な再配布  

---

## 13. Audio Hash

音源確定後、SHA-256 を取得し `audioSha256` を manifest に保存する。

目的: 差し替え防止 / Remix・Live・Radio Edit 混同防止 / Benchmark 再現性 / Dataset integrity  

---

## 14. Manifest Expected Structure

最終的に以下のような構造へ変換する（**STEP 4 — 音源確保後**。今は Selection 確定のみ）。

```ts
export const REAL_SONG_GOLDEN_20 = [
  {
    id: "001",
    title: "アイドル",
    artist: "YOASOBI",
    genre: ["J-POP"],
    conditions: ["VOCAL_HEAVY", "HIGH_ENERGY", "POP_STRUCTURE"],
    doubleAnnotation: false,
    sourceType: "PENDING_AUTHORIZED_SOURCE",
    audioSha256: null,
    annotationStatus: "PENDING",
  },
  // ...
  {
    id: "020",
    title: "Cornfield Chase",
    artist: "Hans Zimmer",
    genre: ["INSTRUMENTAL", "CINEMATIC"],
    conditions: ["INSTRUMENTAL", "DYNAMIC", "CINEMATIC_BUILD"],
    doubleAnnotation: false,
    sourceType: "PENDING_AUTHORIZED_SOURCE",
    audioSha256: null,
    annotationStatus: "PENDING",
  },
] as const;
```

既存 `fixtures/fly/real-song/manifest.ts`（song-001…）への落とし込みは **STEP 4**。

---

## 15. Annotation Status

```text
PENDING
  → AUDIO_READY
  → HASHED
  → ANNOTATION_PENDING
  → ANNOTATED
  → DOUBLE_ANNOTATION_PENDING   (002 / 005 / 010 / 013 only)
  → AGREEMENT_COMPLETE
  → CONSENSUS_COMPLETE
  → BENCHMARK_READY
  → BENCHMARK_COMPLETE
```

Double 対象外は `ANNOTATED` → `BENCHMARK_READY`。

---

## 16. Phase 4.6 Workflow

```text
STEP 1   Golden 20 Selection          ← CURRENT
STEP 2   Authorized Audio Acquisition
STEP 3   SHA-256
STEP 4   Manifest Finalization
STEP 5   Human-first Annotation
STEP 6   Double Annotation
STEP 7   Agreement
STEP 8   Consensus
STEP 9   librosa Analysis
STEP 10  Essentia Analysis
STEP 11  Benchmark
STEP 12  Weakness Detection
STEP 13  Targeted +10 Selection
```

---

## 17. Benchmark Rules

Human GT を Ground Truth とする。比較: Human GT × librosa / Essentia  

評価: Tempo / Beat / Downbeat / Section Boundary / Label / IoU / 8-count / Musical Change  

---

## 18. Missing Data Policy

Analyzer が返せない場合は `NOT_AVAILABLE`。  

**禁止:** `NOT_AVAILABLE = 0`（欠測と性能 0 を混同しない）。

---

## 19. Agreement Policy

| | Meaning |
|---|---------|
| **Agreement** | Human A vs Human B |
| **Accuracy** | Analyzer vs Human Consensus |

High Agreement ≠ High Analyzer Accuracy  

---

## 20. Weakness Detection

Overall Score だけで判断しない。Condition 別に分析する。

例: Overall 72% でも Complex 53% なら  
→ 「Section が弱い」ではなく **「Complex Structure 条件で Section が弱い」**

---

## 21. Active Dataset Expansion

```text
Weakness → Condition Identification → Targeted +10 Songs
```

追加 10 曲は事前固定しない。Golden 20 Benchmark 後に選定する。

---

## 22. Phase 4.6 Freeze Rules

| Area | Freeze |
|------|--------|
| Analyzer | no librosa/Essentia tuning, no madmom, no MSAF |
| Fusion | no weight / priority change |
| Formation | no engine / generation / recommendation |
| Intelligence | no KEEP_CURRENT, Dance Intelligence, AI learning |

**Measure first. Improve later.**

---

## 23. Phase 4.6 Completion Criteria

- [ ] Golden 20 finalized  
- [ ] 20/20 authorized audio confirmed  
- [ ] 20/20 SHA-256 registered  
- [ ] Manifest finalized  
- [ ] 20/20 Human Beat / Downbeat / Section / 8-count / Musical Change GT  
- [ ] 002 / 005 / 010 / 013 double annotation + agreement + consensus  
- [ ] librosa + Essentia benchmarks  
- [ ] Overall + Condition benchmark + Weakness matrix + Evidence confidence  
- [ ] Targeted +10 selected  

---

## 24. Evidence Confidence

例: Score 0.91 / n=5 → Evidence Confidence = **LOW**  

少数曲だけで「FLY は 91%」と主張しない。

---

## 25. Success Definition

成功 = Analyzer 改善ではない。

```text
Human GT → Reliable Benchmark → Condition-based Weakness
  → Evidence-based Dataset Expansion
```

が成立すること。

---

## 26. Final Principle

「この Analyzer を使えば正しい」という前提を置かない。

```text
Human → GT → Benchmark → Evidence → Weakness
  → Additional Dataset → Review → Next Analyzer Decision
```

---

## 27. Next Phase Gate

Phase 4.6 終了後、初めて Phase 5（madmom 候補）を判断する。  

madmom を入れると決めてから Benchmark してはならない。

---

## 28. Current Status

| Item | Status |
|------|--------|
| Golden 20 Selection | **IN PROGRESS → finalize this document** |
| Authorized Audio | PENDING |
| SHA-256 | PENDING |
| Human Annotation | PENDING |
| Double Annotation | PENDING |
| Benchmark | PENDING |
| Weakness Detection | PENDING |
| Phase 4.6 | **NOT COMPLETE** |

---

## 29. Immediate Next Action

**現在は STEP 1 のみを実行する。**

STEP 1 完了条件:

- [x] 20 songs  
- [x] Title / Artist / Genre / Condition / Why Selected / Double Annotation  

Source と SHA-256 は音源確保後（STEP 2–3）。

このファイルを **FINALIZE** したら、次は Authorized Audio（コード不要）。

---

## 30. Explicit Prohibition

このファイルが FINALIZE されるまで、以下を実施しない。

- madmom / MSAF implementation  
- Fusion weight optimization  
- Section / Beat algorithm “improvement”  
- Formation Engine changes  
- KEEP_CURRENT / Dance Intelligence / AI learning  

---

## Phase 4.6 Principle

**Measure first. Improve later.**  

**Human first. Analyzer second.**  

**Evidence before architecture.**

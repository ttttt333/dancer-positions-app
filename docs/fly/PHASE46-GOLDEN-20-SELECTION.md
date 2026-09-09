# FLY Phase 4.6 — Golden 20 Selection Sheet

**dataset:** `4.6.0-stage-a` / **Golden 20**  
**status:** ★ NOW — fill titles before annotation  
**rule:** 有名曲集めではなく、条件マトリクスを埋める。コード変更は曲確定後。

## Locked sequence

```
Golden 20 Selection  ← YOU ARE HERE
  → Authorized audio (local) → sha256 → manifest
  → Human-first annotation
  → Double: 002 / 005 / 010 / 013 → Consensus
  → librosa / Essentia vs GT
  → Weakness → Targeted +10
  → BENCHMARK REVIEW
  → (only if evidence) Phase 5 madmom → 6 MSAF
```

## Genre quota (approx.)

| 枠 | 条件 | 曲数 |
|----|------|------|
| 1 | J-POP / ポップ | 3 |
| 2 | K-POP | 2 |
| 3 | HIP-HOP | 3 |
| 4 | EDM / Dance | 2 |
| 5 | R&B / Funk | 2 |
| 6 | Ballad / Slow | 2 |
| 7 | Trap / 複雑リズム | 2 |
| 8 | Instrumental | 1 |
| 9 | Intro長い / 特殊構成 | 1 |
| 10 | Break / Drop 明確 | 1 |
| 11 | Remix / Live / 複雑構成 | 1 |
| | **合計** | **20** |

## Per-song axes (must fill for every track)

| Axis | Values |
|------|--------|
| BPM class | Slow / Mid / Fast |
| Beat Density | Low / Medium / High |
| Structure Complexity | Simple / Medium / Complex |
| Vocal | Vocal / Instrumental |
| Version | Original / Remix / Live |
| Intro | Short / Normal / Long |
| Break/Drop | None / Moderate / Strong |
| Tempo Change | None / Possible |

Target insight shape:

> not “Essentia is weak on Hip-Hop”  
> but “BPM 90–110 × high density × Complex → Beat Recall drops”

## Annotation rules (reminder)

1. **Human-first** — never show librosa/Essentia before / during first pass  
2. **Don’t over-precision** — ear-level beats/sections; not 0.2s chorus wars  
3. **`musical_change` ≠ formation** — music change only  

SOP: `PHASE46-ANNOTATION-SOP.md`

---

## Selection table (fill Title / Artist / Source)

`songId` matches `fixtures/fly/real-song/manifest.ts`.  
Leave Title blank until a **USER_OWNED / LICENSED / AUTHORIZED** track is chosen.

| songId | Quota role | Why in Golden 20 | FLY capability under test | Double? | Split | Title | Artist | Source | BPM | Density | Structure | Vocal | Version | Intro | Break/Drop | TempoΔ |
|--------|------------|------------------|---------------------------|---------|-------|-------|--------|--------|-----|---------|-----------|-------|---------|-------|------------|--------|
| song-001 | J-POP×1 | Simple pop baseline | Tempo + Beat + clear Section | | DEV | | | | Mid | Med | Simple | Vocal | Orig | Normal | None | None |
| song-002 | K-POP×1 | Dense / complex idol structure | Section + PreChorus ambiguity + Beat density | **yes** | DEV | | | | Fast | High | Complex | Vocal | Orig | Normal | Mod | None |
| song-003 | HIP-HOP×1 | Sparse kick / space | Beat on low density; 8-count feel | | DEV | | | | Mid | Low | Med | Vocal | Orig | Normal | None | None |
| song-004 | R&B×1 | Slow groove | Slow Beat/Downbeat stability | | DEV | | | | Slow | Low | Simple | Vocal | Orig | Normal | None | None |
| song-005 | EDM×1 | Drop vocabulary | musical_change HIGH (DROP) + Section BREAK→DROP | **yes** | DEV | | | | Fast | High | Med | Vocal | Orig | Normal | **Strong** | None |
| song-006 | Funk×1 | Syncopation risk | Beat vs off-beat; onset≠beat | | DEV | | | | Mid | High | Med | Vocal | Orig | Normal | None | None |
| song-007 | Trap×1 | Sparse kick + dense hats | Beat pulse choice; density mismatch | | DEV | | | | Mid | Low* | Med | Vocal | Orig | Normal | Mod | None |
| song-008 | Ballad×1 | Slow simple vocal | Slow timing; sparse events | | DEV | | | | Slow | Low | Simple | Vocal | Orig | Normal | None | None |
| song-009 | Instrumental×1 | No lyric section cues | Section without vocal; Beat-only structure | | DEV | | | | Mid | Med | Simple | **Instr** | Orig | Normal | None | None |
| song-010 | Complex×1 | Odd / multi-part form | Section Boundary F1 under Complex | **yes** | DEV | | | | Mid | High | **Complex** | Vocal | Orig | Normal | Mod | Possible |
| song-011 | J-POP×2 / Long intro | Unusual intro length | Intro boundary; late first chorus | | DEV | | | | Mid | Med | Med | Vocal | Orig | **Long** | None | None |
| song-012 | EDM×2 / Long breakdown | Extended breakdown | BREAK duration; energy drop labeling | | DEV | | | | Fast | Low | Med | Instr | Orig | Normal | **Strong** | None |
| song-013 | Live | Tempo drift / imperfect grid | Beat/BPM under Live; human disagreement | **yes** | VAL | | | | Mid | Med | Med | Vocal | **Live** | Normal | None | Possible |
| song-014 | Remix | Structure odd vs original | Section labels under Remix | | VAL | | | | Fast | High | Complex | Vocal | **Remix** | Normal | Mod | None |
| song-015 | Mashup / complex | Abrupt joins | Section + musical_change spam control | | VAL | | | | Mid | High | Complex | Vocal | Mashup† | Short | Strong | Possible |
| song-016 | Tempo change | Mid-song tempo | BPM class error / multi-tempo note | | VAL | | | | Mid | Med | Complex | Vocal | Orig | Normal | None | **Possible** |
| song-017 | HIP-HOP×2 holdout | Break-heavy hip-hop | Holdout Section/Break; no train-on | | HOLD | | | | Mid | Med | Complex | Vocal | Orig | Normal | Strong | None |
| song-018 | K-POP×2 holdout | Pre-chorus ambiguity | Holdout Section label agreement | | HOLD | | | | Fast | High | Complex | Vocal | Orig | Normal | Mod | None |
| song-019 | Ballad×2 live holdout | Slow + live | Holdout slow Live Beat | | HOLD | | | | Slow | Low | Simple | Vocal | **Live** | Normal | None | Possible |
| song-020 | Dense EDM instr holdout | No vocal + high density | Holdout Beat density instrumental | | HOLD | | | | Fast | High | Med | **Instr** | Orig | Normal | Strong | None |

\* Trap: kick sparse, hats may feel “dense” — put real feel in notes; use `flags: hihat-dense` in manifest.  
† Mashup → manifest `version: MASHUP` (sheet “Version” column).

### Double-annotation (mandatory)

| songId | Why double |
|--------|------------|
| song-002 | Complex K-POP sections — human label disagreement expected |
| song-005 | DROP / BREAK timing — strength of musical_change |
| song-010 | Complex form — boundary median ms |
| song-013 | Live drift — Beat/BPM human variance |

---

## Fill protocol

1. For each row, pick **one owned/licensed** track that matches axes (not “famous enough”).  
2. Write **one sentence** in a working copy: “This tests ___.”  
3. Only then: local audio → sha256 → update `manifest.ts` titles (code later).  
4. Do **not** start annotation until Human-first environment is ready (no AI overlay).

## Anti-patterns

- Filling with 20 chart hits that are all Mid / Med / Simple / Vocal / Original  
- Choosing a track because “Essentia already looks good on it”  
- Annotating while watching analyzer grids  

## After titles are filled

Hand sheet → update manifest metadata → hash audio → annotate per SOP → Benchmark Review (still no madmom).

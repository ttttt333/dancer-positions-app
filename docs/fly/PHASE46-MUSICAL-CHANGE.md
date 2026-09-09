# FLY Phase 4.6 — musical_change

**contract_version:** `1.0.0`

## Definition

A human-judged **musical** change point:

```ts
strength: "LOW" | "MEDIUM" | "HIGH"
reasons: MusicalChangeReason[]
timeSec, confidence
```

## Critical rule

```
musical_change  ≠  formation_change
```

Phase 4.6 records music understanding only.  
Dance / formation translation is a **later** phase.

## Reasons

SECTION_CHANGE, ENERGY_RISE, ENERGY_DROP, BEAT_CHANGE, RHYTHM_CHANGE,  
INSTRUMENT_CHANGE, VOCAL_CHANGE, DROP, BREAK, IMPACT, OTHER

## Bridge to Benchmark (optional)

May map to Fly GT `events` for timing metrics — never to Formation Engine.

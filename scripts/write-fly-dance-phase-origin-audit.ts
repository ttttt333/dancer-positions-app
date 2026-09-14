/**
 * PHASE 4.6-D — Dance Phase Origin Audit
 *
 * Probes A–G on Golden 20 using existing GT only.
 * Hypothesis testing — NEVER auto-adopt lowest-error probe as truth.
 * NEVER retarget GT to analyzers.
 *
 * Usage: npm run fly:dance-phase-origin-audit
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveBeatPattern,
  deriveDownbeatPattern,
} from "../src/lib/fly/realSong/beatPattern";
import {
  fitFractionalBeat,
  hypothesizeOriginStructure,
  nearestFormCue,
  offsetFromRef,
  type OriginHypothesisLabel,
} from "../src/lib/fly/realSong/dancePhaseOriginAudit";
import { loadAllGroundTruth } from "../src/lib/fly/realSong/loadGt";
import { FLY_REAL_SONG_DATASET_VERSION } from "../src/lib/fly/realSong/versions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");
mkdirSync(outDir, { recursive: true });

const AUDIT_ID = "4.6-d-dance-phase-origin-v1";

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function countBy(xs: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of xs) o[x] = (o[x] ?? 0) + 1;
  return o;
}

type SongOriginAudit = {
  songId: string;
  title: string;
  gtSource: string;
  proxy: {
    kind: "COUNT_GRID";
    timeSec: number;
    note: string;
  };
  beat: {
    phase0Sec: number;
    intervalSec: number;
    signedSec: number;
    absSec: number;
    absBeats: number;
  };
  downbeat: {
    phase0Sec: number;
    intervalSec: number;
    signedSec: number;
    absSec: number;
    absBeats: number;
  } | null;
  /** Probe C: Beat / Down relative to CountGrid-as-0 */
  fromCountGrid: {
    beatSignedSec: number;
    beatAbsBeats: number;
    downSignedSec: number | null;
    downAbsBeats: number | null;
  };
  quarter: ReturnType<typeof fitFractionalBeat>;
  half: ReturnType<typeof fitFractionalBeat>;
  form: ReturnType<typeof nearestFormCue>;
  hypothesis: { label: OriginHypothesisLabel; rationale: string };
  notes: string[];
};

const gts = loadAllGroundTruth();
const songs: SongOriginAudit[] = [];

for (const gt of gts) {
  const cg = gt.annotation.countGrid?.startSec;
  if (cg == null || !Number.isFinite(cg)) {
    console.warn(`no countGrid ${gt.songId}`);
    continue;
  }
  const beatPat = deriveBeatPattern(gt.annotation, gt.durationSec);
  if (!beatPat) continue;
  const downPat = deriveDownbeatPattern(gt.annotation, gt.durationSec);

  // A: Beat as 0 → Dance Phase proxy (CountGrid) offset
  const beatOff = offsetFromRef(cg, beatPat.phaseSec, beatPat.intervalSec);

  // B: Downbeat as 0
  let downOff: SongOriginAudit["downbeat"] = null;
  if (downPat) {
    const d = offsetFromRef(cg, downPat.phaseSec, downPat.intervalSec);
    downOff = {
      phase0Sec: downPat.phaseSec,
      intervalSec: downPat.intervalSec,
      signedSec: d.signedSec,
      absSec: d.absSec,
      absBeats: d.absBeats,
    };
  }

  // C: CountGrid as 0 → Beat/Down offsets (inverse view)
  const beatFromCg = offsetFromRef(beatPat.phaseSec, cg, beatPat.intervalSec);
  const downFromCg = downPat
    ? offsetFromRef(downPat.phaseSec, cg, downPat.intervalSec)
    : null;

  // D / E
  const quarter = fitFractionalBeat(cg, beatPat.phaseSec, beatPat.intervalSec, [
    -0.25, 0.25,
  ]);
  const half = fitFractionalBeat(cg, beatPat.phaseSec, beatPat.intervalSec, [
    -0.5, 0.5,
  ]);

  // F: Section / MC
  const sectionBounds: number[] = [];
  for (const s of gt.annotation.sections) {
    sectionBounds.push(s.startSec, s.endSec);
  }
  const mcTimes = (gt.annotation.musicalChanges ?? []).map((m) => m.timeSec);
  const form = nearestFormCue(cg, sectionBounds, mcTimes);

  const hypothesis = hypothesizeOriginStructure({
    beatAbsBeats: beatOff.absBeats,
    downAbsBeats: downOff?.absBeats ?? null,
    quarterAbsBeats: quarter.bestAbsBeats,
    halfAbsBeats: half.bestAbsBeats,
    formAbsSec: form.absSec,
  });

  const notes: string[] = [
    `proxy=CountGrid@${cg.toFixed(3)} (provisional Dance Phase origin — not proven L3 GT)`,
  ];
  if (hypothesis.label === "COUNTGRID_HALF_OFFSET") {
    notes.push(
      "Half-beat fit is diagnostic only — must not become silent dual Music Beat GT (013 policy)"
    );
  }
  if (form.absSec != null && form.absSec < 0.2) {
    notes.push(`Form cue nearby: ${form.detail}`);
  }

  songs.push({
    songId: gt.songId,
    title: gt.title,
    gtSource: gt.gtSource,
    proxy: {
      kind: "COUNT_GRID",
      timeSec: cg,
      note: "Interim Dance Phase origin proxy per 4.6-D spec",
    },
    beat: {
      phase0Sec: beatPat.phaseSec,
      intervalSec: beatPat.intervalSec,
      signedSec: beatOff.signedSec,
      absSec: beatOff.absSec,
      absBeats: beatOff.absBeats,
    },
    downbeat: downOff,
    fromCountGrid: {
      beatSignedSec: beatFromCg.signedSec,
      beatAbsBeats: beatFromCg.absBeats,
      downSignedSec: downFromCg?.signedSec ?? null,
      downAbsBeats: downFromCg?.absBeats ?? null,
    },
    quarter,
    half,
    form,
    hypothesis,
    notes,
  });
}

const hypCounts = countBy(songs.map((s) => s.hypothesis.label));
const nearBeat = songs.filter((s) => s.beat.absBeats <= 0.12).length;
const nearDown = songs.filter(
  (s) => s.downbeat != null && s.downbeat.absBeats <= 0.12
).length;
const equalsBeat = songs.filter((s) => s.beat.absBeats <= 0.02).length;
const alignedTriple = songs.filter(
  (s) =>
    s.beat.absBeats <= 0.02 &&
    s.downbeat != null &&
    s.downbeat.absBeats <= 0.02
).length;
const quarterBetter =
  songs.filter(
    (s) =>
      s.quarter.bestAbsBeats != null &&
      s.beat.absBeats > 0.12 &&
      s.quarter.bestAbsBeats <= 0.12
  ).length;
const halfBetter =
  songs.filter(
    (s) =>
      s.half.bestAbsBeats != null &&
      s.beat.absBeats > 0.12 &&
      s.half.bestAbsBeats <= 0.12
  ).length;
const formNear = songs.filter(
  (s) => s.form.absSec != null && s.form.absSec <= 0.15
).length;

// G: per-song structure diversity
const uniqueLabels = Object.keys(hypCounts).length;
const dominant = Object.entries(hypCounts).sort((a, b) => b[1] - a[1])[0];
const dominantShare = dominant ? dominant[1] / songs.length : 0;

function evaluateGate(opts: {
  songs: SongOriginAudit[];
  hypCounts: Record<string, number>;
  nearBeat: number;
  nearDown: number;
  quarterBetter: number;
  halfBetter: number;
  equalsBeat: number;
  alignedTriple: number;
}): {
  gate: "CONDITIONAL-GO" | "NO-GO" | "GO";
  reasons: string[];
  risks: string[];
} {
  const { songs, hypCounts, nearBeat, nearDown, quarterBetter, halfBetter, equalsBeat, alignedTriple } =
    opts;
  const reasons: string[] = [];
  const risks: string[] = [];
  const n = songs.length;

  // Primary structural finding
  if (equalsBeat >= n * 0.7) {
    reasons.push(
      `${equalsBeat}/${n} CountGrid ≈ Beat phase0 — common encoding: dance count-1 currently = Music Beat origin`
    );
    risks.push(
      "DATA LIMIT: CountGrid proxy cannot validate a Dance Phase Origin distinct from Music Beat — dedicated Phase Anchor annotation required"
    );
  }
  if (alignedTriple >= n * 0.5) {
    reasons.push(
      `${alignedTriple}/${n} CountGrid ≈ Beat ≈ Downbeat — bar/beat/count-1 collapsed into one time`
    );
  }

  if (nearBeat >= 8) {
    reasons.push(
      `${nearBeat}/${n} CountGrid near Beat — Music Beat is the dominant *encoded* origin in current GT`
    );
  }
  if (nearDown >= 8) {
    reasons.push(`${nearDown}/${n} also near Downbeat (often same point as Beat[0])`);
  }

  // Good: fractional probes are NOT the story
  if (quarterBetter + halfBetter === 0) {
    reasons.push(
      "±1/4 and ±1/2 are NOT required for numeric fit — avoids post-hoc half/quarter gaming"
    );
  } else if (quarterBetter + halfBetter >= 10 && nearBeat < 5) {
    risks.push(
      "Many songs only 'improve' under ±1/4 or ±1/2 — risk of post-hoc numeric fit"
    );
  }

  const song013 = songs.find((s) => s.songId === "song-013");
  if (song013) {
    reasons.push(
      `song-013: CountGrid=${song013.proxy.timeSec.toFixed(3)} Beat0=${song013.beat.phase0Sec.toFixed(3)} → ${song013.hypothesis.label}`
    );
    reasons.push(
      "013 analyzer Phase FAIL is vs this shared Music Beat/CountGrid origin — not vs a separate Dance Phase Anchor"
    );
  }

  reasons.push("Lowest-error probe was NOT auto-adopted");
  reasons.push("GT was not retargeted to analyzers");

  // Gate: CONDITIONAL-GO when structure is clear but L3 not separable
  let gate: "CONDITIONAL-GO" | "NO-GO" | "GO" = "CONDITIONAL-GO";
  if (equalsBeat >= n * 0.7 && quarterBetter + halfBetter === 0) {
    gate = "CONDITIONAL-GO";
    reasons.push(
      "CONDITIONAL-GO: Origin structure is explainable (CountGrid≡Beat), but Dance Phase Model needs independent Anchor GT before claiming L3"
    );
  }
  if (quarterBetter + halfBetter >= 10 && equalsBeat < 5) {
    gate = "NO-GO";
  }

  void hypCounts;
  return { gate, reasons, risks };
}

const gate = evaluateGate({
  songs,
  hypCounts,
  nearBeat,
  nearDown,
  quarterBetter,
  halfBetter,
  equalsBeat,
  alignedTriple,
});
const song013 = songs.find((s) => s.songId === "song-013") ?? null;

const payload = {
  auditId: AUDIT_ID,
  status: "COMPLETE",
  computedAt: new Date().toISOString(),
  datasetVersion: FLY_REAL_SONG_DATASET_VERSION,
  policy: {
    noNewAnalyzer: true,
    noFusion: true,
    noMsaf: true,
    noAutoAdoptLowestError: true,
    noGtRetargetToAnalyzer: true,
    dancePhaseProxy: "countGrid.startSec",
  },
  probes: {
    A: "Beat as 0 → CountGrid (Dance Phase proxy) offset",
    B: "Downbeat as 0 → CountGrid offset",
    C: "CountGrid as 0 → Beat/Downbeat offsets",
    D: "±1/4 beat from Beat",
    E: "±1/2 beat from Beat",
    F: "Nearest Section boundary / Musical Change",
    G: "Per-song origin hypothesis diversity",
  },
  summary: {
    n: songs.length,
    hypothesisCounts: hypCounts,
    nearBeatCount: nearBeat,
    nearDownbeatCount: nearDown,
    countGridEqualsBeatCount: equalsBeat,
    countGridBeatDownAlignedCount: alignedTriple,
    quarterOnlyFitCount: quarterBetter,
    halfOnlyFitCount: halfBetter,
    formNearCount: formNear,
    dominantHypothesis: dominant?.[0] ?? null,
    dominantShare,
    uniqueHypothesisLabels: uniqueLabels,
    metaFinding:
      "CountGrid is largely identical to Beat phase0 in current GT — Dance Phase Origin is not independently annotated yet",
  },
  gate,
  song013: song013
    ? {
        hypothesis: song013.hypothesis,
        beatAbsBeats: song013.beat.absBeats,
        beatAbsMs: Math.round(song013.beat.absSec * 1000),
        downAbsBeats: song013.downbeat?.absBeats ?? null,
        quarter: song013.quarter,
        half: song013.half,
        form: song013.form,
        notes: song013.notes,
      }
    : null,
  songs,
};

writeFileSync(
  join(outDir, "dance-phase-origin-audit.json"),
  JSON.stringify(payload, null, 2) + "\n"
);

const md: string[] = [];
md.push(`# PHASE 4.6-D — Dance Phase Origin Audit`);
md.push(``);
md.push(`**Audit ID:** \`${AUDIT_ID}\``);
md.push(`**Status:** COMPLETE`);
md.push(`**Dataset:** \`${FLY_REAL_SONG_DATASET_VERSION}\``);
md.push(`**Gate (definition progress):** **${gate.gate}**`);
md.push(``);
md.push(`## Purpose`);
md.push(``);
md.push(`Identify **Phase Origin** candidates between L2 Musical Beat Reference and L3 Dance Phase.`);
md.push(`Existing data only. **Not** auto-adopting the lowest-error probe.`);
md.push(``);
md.push(`## Proxy (explicit)`);
md.push(``);
md.push(`Interim Dance Phase origin = **\`countGrid.startSec\`** (human).`);
md.push(`Labeled provisional — not full L3 GT annotation.`);
md.push(``);
md.push(`## Probe summary`);
md.push(``);
md.push(
  mdTable(
    ["Probe", "Result"],
    [
      ["A Beat as 0", `${nearBeat}/20 CountGrid within 0.12 beat of Beat phase0`],
      ["B Downbeat as 0", `${nearDown}/20 within 0.12 beat of Downbeat phase0`],
      ["C CountGrid as 0", `Inverse of A/B (same geometry; see per-song)`],
      ["D ±1/4 beat", `${quarterBetter}/20 fit quarter **only if** Beat not already near`],
      ["E ±1/2 beat", `${halfBetter}/20 fit half **only if** Beat not already near`],
      ["F Section/MC", `${formNear}/20 CountGrid within 150ms of form cue`],
      [
        "G Per-song",
        `dominant=${dominant?.[0] ?? "—"} (${(dominantShare * 100).toFixed(0)}%); ${uniqueLabels} labels`,
      ],
    ]
  )
);
md.push(``);
md.push(`## Hypothesis counts (review labels — not adoption)`);
md.push(``);
md.push(
  mdTable(
    ["Hypothesis", "n"],
    Object.entries(hypCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, String(v)])
  )
);
md.push(``);
md.push(`## Gate evaluation`);
md.push(``);
md.push(`### Reasons toward GO`);
md.push(``);
for (const r of gate.reasons) md.push(`- ${r}`);
md.push(``);
md.push(`### Risks / NO-GO pressures`);
md.push(``);
if (gate.risks.length) for (const r of gate.risks) md.push(`- ${r}`);
else md.push(`- (none flagged above threshold)`);
md.push(``);
md.push(`### Decision`);
md.push(``);
md.push(`**${gate.gate}** — definition may proceed to human review of Origin policy; **do not** ship Fusion or rewrite Beat GT.`);
md.push(``);
md.push(`## song-013`);
md.push(``);
if (song013) {
  md.push(`- Hypothesis: **${song013.hypothesis.label}**`);
  md.push(`- ${song013.hypothesis.rationale}`);
  md.push(
    `- A Beat: ${song013.beat.absBeats.toFixed(3)} beat (${Math.round(song013.beat.absSec * 1000)}ms signed ${Math.round(song013.beat.signedSec * 1000)}ms)`
  );
  md.push(
    `- B Down: ${
      song013.downbeat
        ? `${song013.downbeat.absBeats.toFixed(3)} beat`
        : "n/a"
    }`
  );
  md.push(
    `- D Quarter: ${song013.quarter.detail} absBeats=${song013.quarter.bestAbsBeats?.toFixed(3) ?? "—"}`
  );
  md.push(
    `- E Half: ${song013.half.detail} absBeats=${song013.half.bestAbsBeats?.toFixed(3) ?? "—"}`
  );
  md.push(`- F Form: ${song013.form.detail}`);
  for (const n of song013.notes) md.push(`- ${n}`);
}
md.push(``);
md.push(`## Per-song`);
md.push(``);
md.push(
  mdTable(
    [
      "ID",
      "Title",
      "Hyp",
      "Beat beats",
      "Down beats",
      "¼",
      "½",
      "Form ms",
    ],
    songs.map((s) => [
      s.songId.replace("song-", ""),
      s.title.replace(/\|/g, "/"),
      s.hypothesis.label.replace("COUNTGRID_", ""),
      s.beat.absBeats.toFixed(2),
      s.downbeat ? s.downbeat.absBeats.toFixed(2) : "—",
      s.quarter.bestAbsBeats?.toFixed(2) ?? "—",
      s.half.bestAbsBeats?.toFixed(2) ?? "—",
      s.form.absSec != null ? String(Math.round(s.form.absSec * 1000)) : "—",
    ])
  )
);
md.push(``);
md.push(`## What this does **not** mean`);
md.push(``);
md.push(`- ✗ Pick ±1/4 or ±1/2 because it shrinks milliseconds`);
md.push(`- ✗ Analyzer agreement defines Dance Phase Origin`);
md.push(`- ✗ Rewrite Consensus Beat to match CountGrid`);
md.push(`- ✓ Human can now argue Origin policy with Evidence`);

writeFileSync(join(outDir, "dance-phase-origin-audit.md"), md.join("\n") + "\n");

console.log(`Dance Phase Origin Audit: ${songs.length} songs → gate ${gate.gate}`);
console.log("hypotheses", hypCounts);
console.log("013", song013?.hypothesis.label, song013?.hypothesis.rationale);

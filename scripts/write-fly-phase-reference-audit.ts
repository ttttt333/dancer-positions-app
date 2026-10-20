/**
 * PHASE 4.6-C — Common Phase Reference Audit
 *
 * No new analyzers. No Fusion. No MSAF. No GT edits.
 *
 * Usage: npm run fly:phase-reference-audit
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveBeatPattern,
  deriveDownbeatPattern,
} from "../src/lib/fly/realSong/beatPattern";
import {
  loadAllGroundTruth,
  resolveRealSongRoot,
} from "../src/lib/fly/realSong/loadGt";
import {
  classifyAnalyzerRelation,
  classifyHalfBeatBin,
  circularPhaseDistanceSec,
  signedPhaseResidualSec,
  summarizePhaseOffset,
  type PhaseRelationClass,
} from "../src/lib/fly/realSong/phaseReferenceAudit";
import type { AnalyzerHypothesisFile } from "../src/lib/fly/realSong/types";
import { FLY_REAL_SONG_DATASET_VERSION } from "../src/lib/fly/realSong/versions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");
mkdirSync(outDir, { recursive: true });

const AUDIT_ID = "4.6-c-phase-reference-v1";

function loadHyp(
  songId: string,
  analyzer: string
): AnalyzerHypothesisFile | null {
  const path = join(
    resolveRealSongRoot(),
    "hypotheses",
    songId,
    `${analyzer}.json`
  );
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as AnalyzerHypothesisFile;
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

type SongAudit = {
  songId: string;
  title: string;
  gtSource: string;
  gt: {
    bpm: number | null;
    beatIntervalSec: number;
    beatPhase0Sec: number;
    beatSeeds: number;
    downIntervalSec: number | null;
    downPhase0Sec: number | null;
    countGridStartSec: number | null;
    countGridOffsetFromBeatSec: number | null;
    countGridHalfBin: string;
  };
  librosaBeat: ReturnType<typeof summarizePhaseOffset>;
  madmomBeat: ReturnType<typeof summarizePhaseOffset>;
  librosaDown: ReturnType<typeof summarizePhaseOffset> | null;
  madmomDown: ReturnType<typeof summarizePhaseOffset> | null;
  analyzerAgreeSec: number | null;
  analyzerAgreeBeats: number | null;
  relation: PhaseRelationClass;
  phaseWander: { librosa: boolean; madmom: boolean };
  notes: string[];
};

const gts = loadAllGroundTruth();
const songs: SongAudit[] = [];

for (const gt of gts) {
  const beatPat = deriveBeatPattern(gt.annotation, gt.durationSec);
  if (!beatPat) continue;
  const downPat = deriveDownbeatPattern(gt.annotation, gt.durationSec);
  const lib = loadHyp(gt.songId, "librosa");
  const mad = loadHyp(gt.songId, "madmom");
  if (!lib?.beats || !mad?.beats) {
    console.warn(`missing hyp ${gt.songId}`);
    continue;
  }

  const window = {
    startSec: beatPat.patternStartSec,
    endSec: beatPat.continuationUntilSec,
  };

  const librosaBeat = summarizePhaseOffset(
    lib.beats,
    beatPat.phaseSec,
    beatPat.intervalSec,
    window
  );
  const madmomBeat = summarizePhaseOffset(
    mad.beats,
    beatPat.phaseSec,
    beatPat.intervalSec,
    window
  );

  let analyzerAgreeSec: number | null = null;
  let analyzerAgreeBeats: number | null = null;
  if (
    librosaBeat.medianSignedSec != null &&
    madmomBeat.medianSignedSec != null
  ) {
    analyzerAgreeSec = circularPhaseDistanceSec(
      librosaBeat.medianSignedSec,
      madmomBeat.medianSignedSec,
      beatPat.intervalSec
    );
    analyzerAgreeBeats = analyzerAgreeSec / beatPat.intervalSec;
  }

  const relation = classifyAnalyzerRelation({
    librosaAbsSec: librosaBeat.medianAbsSec,
    madmomAbsSec: madmomBeat.medianAbsSec,
    analyzerAgreeSec,
    nearGtSec: 0.04, // align with Phase PASS band
    agreeSec: 0.06,
  });

  const libWander =
    librosaBeat.medianAbsSec != null &&
    librosaBeat.medianSignedSec != null &&
    librosaBeat.medianAbsSec > 0.08 &&
    Math.abs(librosaBeat.medianSignedSec) < 0.04;
  const madWander =
    madmomBeat.medianAbsSec != null &&
    madmomBeat.medianSignedSec != null &&
    madmomBeat.medianAbsSec > 0.08 &&
    Math.abs(madmomBeat.medianSignedSec) < 0.04;

  const librosaDown = downPat
    ? summarizePhaseOffset(
        lib.downbeats ?? [],
        downPat.phaseSec,
        downPat.intervalSec,
        {
          startSec: downPat.patternStartSec,
          endSec: downPat.continuationUntilSec,
        }
      )
    : null;
  const madmomDown = downPat
    ? summarizePhaseOffset(
        mad.downbeats ?? [],
        downPat.phaseSec,
        downPat.intervalSec,
        {
          startSec: downPat.patternStartSec,
          endSec: downPat.continuationUntilSec,
        }
      )
    : null;

  const cg = gt.annotation.countGrid?.startSec ?? null;
  let countGridOffset: number | null = null;
  let countGridBin = "NO_COUNTGRID";
  if (cg != null) {
    countGridOffset = signedPhaseResidualSec(
      cg,
      beatPat.phaseSec,
      beatPat.intervalSec
    );
    countGridBin = classifyHalfBeatBin(countGridOffset, beatPat.intervalSec);
  }

  const notes: string[] = [];
  if (relation === "BOTH_OFF_AGREE") {
    notes.push(
      "librosa≈madmom but both off GT → Phase Reference / Dance Phase definition more likely than analyzer-swap"
    );
  }
  if (relation === "BOTH_OFF_DISAGREE") {
    notes.push(
      "analyzers disagree & both off GT → ensemble only after reference clarity"
    );
  }
  if (relation === "LIBROSA_CLOSER" || relation === "MADMOM_CLOSER") {
    notes.push(`${relation} — weak signal for future selective fusion (not now)`);
  }
  if (libWander) {
    notes.push(
      "librosa: |phase| high but signed-median≈0 → phase wander / sign mix (not a stable offset)"
    );
  }
  if (madWander) {
    notes.push(
      "madmom: |phase| high but signed-median≈0 → phase wander / sign mix (not a stable offset)"
    );
  }
  for (const [name, sum] of [
    ["librosa", librosaBeat],
    ["madmom", madmomBeat],
  ] as const) {
    if (
      sum.halfBeatBin === "NEAR_PLUS_HALF" ||
      sum.halfBeatBin === "NEAR_MINUS_HALF"
    ) {
      notes.push(
        `${name} half-beat ${sum.halfBeatBin} (abs=${sum.medianAbsSec?.toFixed(3)}s signed=${sum.medianSignedSec?.toFixed(3)}s)`
      );
    }
  }

  songs.push({
    songId: gt.songId,
    title: gt.title,
    gtSource: gt.gtSource,
    gt: {
      bpm: gt.annotation.bpm,
      beatIntervalSec: beatPat.intervalSec,
      beatPhase0Sec: beatPat.phaseSec,
      beatSeeds: beatPat.seedCount,
      downIntervalSec: downPat?.intervalSec ?? null,
      downPhase0Sec: downPat?.phaseSec ?? null,
      countGridStartSec: cg,
      countGridOffsetFromBeatSec: countGridOffset,
      countGridHalfBin: countGridBin,
    },
    librosaBeat,
    madmomBeat,
    librosaDown,
    madmomDown,
  analyzerAgreeSec,
  analyzerAgreeBeats,
  relation,
  phaseWander: { librosa: libWander, madmom: madWander },
  notes,
});
}

function countBy<T extends string>(xs: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

const relationCounts = countBy(songs.map((s) => s.relation));
const librosaBins = countBy(songs.map((s) => s.librosaBeat.halfBeatBin));
const madmomBins = countBy(songs.map((s) => s.madmomBeat.halfBeatBin));

const bothOffAgree = songs.filter((s) => s.relation === "BOTH_OFF_AGREE");
const bothOffDisagree = songs.filter((s) => s.relation === "BOTH_OFF_DISAGREE");
const closerSplit = songs.filter(
  (s) => s.relation === "LIBROSA_CLOSER" || s.relation === "MADMOM_CLOSER"
);
const wanderCount = songs.filter(
  (s) => s.phaseWander.librosa || s.phaseWander.madmom
).length;

const signBias = (who: "librosaBeat" | "madmomBeat") => {
  let plus = 0;
  let minus = 0;
  let near0 = 0;
  for (const s of songs) {
    const v = s[who].medianSignedSec;
    if (v == null) continue;
    if (Math.abs(v) < 0.04) near0++;
    else if (v > 0) plus++;
    else minus++;
  }
  return { plus, minus, near0 };
};

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
    noGtEdit: true,
  },
  developmentLogFinding:
    "madmom improved Period substantially (16→19), but Phase remained 0/20. Therefore the dominant Phase weakness is not solved by replacing the beat/tempo analyzer. FLY must investigate the common Phase Reference / Dance Phase definition before adding further analyzers or Fusion.",
  metricNote:
    "medianAbsSec = median(|signed residual|). medianSignedSec can cancel when phase wanders; do not use abs(signed-median) as Phase magnitude.",
  hypotheses: {
    A_analyzerBeatWrong: "Analyzer beat positions themselves are wrong",
    B_phaseReferenceInsufficient:
      "Analyzers may be coherent, but FLY Phase reference / Dance Phase definition is insufficient",
    C_multiCueDancePhase:
      "Dance Phase may require kick/snare/downbeat/groove cues beyond a single beat sequence",
  },
  summary: {
    n: songs.length,
    relationCounts,
    librosaHalfBeatBins: librosaBins,
    madmomHalfBeatBins: madmomBins,
    librosaSignBias: signBias("librosaBeat"),
    madmomSignBias: signBias("madmomBeat"),
    bothOffAgreeCount: bothOffAgree.length,
    bothOffDisagreeCount: bothOffDisagree.length,
    selectiveCloserCount: closerSplit.length,
    phaseWanderSongCount: wanderCount,
    meanAnalyzerAgreeSec:
      songs
        .map((s) => s.analyzerAgreeSec)
        .filter((x): x is number => x != null)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || null,
    meanLibrosaAbsMs: Math.round(
      1000 *
        (songs
          .map((s) => s.librosaBeat.medianAbsSec)
          .filter((x): x is number => x != null)
          .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0)
    ),
    meanMadmomAbsMs: Math.round(
      1000 *
        (songs
          .map((s) => s.madmomBeat.medianAbsSec)
          .filter((x): x is number => x != null)
          .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0)
    ),
  },
  interpretation: {
    supportForHypothesisB:
      bothOffAgree.length >= Math.ceil(songs.length * 0.4)
        ? "STRONG"
        : bothOffAgree.length >= 5
          ? "MODERATE"
          : bothOffAgree.length >= 2
            ? "PRESENT"
            : "WEAK",
    supportForHypothesisA_or_C_wander:
      wanderCount >= 5 ? "STRONG" : wanderCount >= 2 ? "MODERATE" : "WEAK",
    supportForFusionNow:
      closerSplit.length >= 8 && bothOffAgree.length < 5
        ? "MAYBE_LATER"
        : "NO",
    supportForMoreAnalyzerSwap: "NO — Experiment B already showed Period≠Phase",
    nextLayerHint:
      "Music Evidence → Beat Reference → Dance Phase → Count Grid (do not Fusion first)",
  },
  song013,
  bothOffAgreeSongIds: bothOffAgree.map((s) => s.songId),
  bothOffDisagreeSongIds: bothOffDisagree.map((s) => s.songId),
  songs,
};

writeFileSync(
  join(outDir, "phase-reference-audit.json"),
  JSON.stringify(payload, null, 2) + "\n"
);

const md: string[] = [];
md.push(`# PHASE 4.6-C — Common Phase Reference Audit`);
md.push(``);
md.push(`**Status:** COMPLETE`);
md.push(`**Audit ID:** \`${AUDIT_ID}\``);
md.push(`**Dataset:** \`${FLY_REAL_SONG_DATASET_VERSION}\``);
md.push(`**Scope:** measurement only — no analyzer add · no Fusion · no MSAF · no GT edit`);
md.push(``);
md.push(`## Development log (locked finding)`);
md.push(``);
md.push(`> ${payload.developmentLogFinding}`);
md.push(``);
md.push(`## Why this audit`);
md.push(``);
md.push(`Experiment B showed Period can improve while Phase stays 0/20.`);
md.push(`So before more analyzers or Fusion, ask whether the failure is:`);
md.push(``);
md.push(`| Hyp | Claim |`);
md.push(`|-----|-------|`);
md.push(`| A | Analyzer beat positions themselves are wrong |`);
md.push(`| B | Analyzers can agree, but FLY Phase reference / Dance Phase definition is insufficient |`);
md.push(`| C | Dance Phase needs multi-cue evidence beyond one beat sequence |`);
md.push(``);
md.push(`## ① Signed Phase error direction`);
md.push(``);
md.push(
  mdTable(
    ["Analyzer", "+ (late vs GT)", "− (early vs GT)", "near 0 (|e|<40ms)"],
    [
      [
        "librosa",
        String(payload.summary.librosaSignBias.plus),
        String(payload.summary.librosaSignBias.minus),
        String(payload.summary.librosaSignBias.near0),
      ],
      [
        "madmom",
        String(payload.summary.madmomSignBias.plus),
        String(payload.summary.madmomSignBias.minus),
        String(payload.summary.madmomSignBias.near0),
      ],
    ]
  )
);
md.push(``);
md.push(`Signed residual = hyp beat folded onto GT grid in (−½ IOI, +½ IOI].`);
md.push(`+ = analyzer late vs GT seed phase0; − = early.`);
md.push(``);
md.push(`## ② Half-beat bins`);
md.push(``);
md.push(
  mdTable(
    ["Bin", "librosa n", "madmom n"],
    [
      ...Array.from(
        new Set([
          ...Object.keys(librosaBins),
          ...Object.keys(madmomBins),
        ])
      ).map((bin) => [
        bin,
        String(librosaBins[bin] ?? 0),
        String(madmomBins[bin] ?? 0),
      ]),
    ]
  )
);
md.push(``);
md.push(`## ③ / ④ Analyzer relation vs GT`);
md.push(``);
md.push(
  mdTable(
    ["Relation", "n", "Meaning"],
    [
      [
        "BOTH_OFF_AGREE",
        String(relationCounts.BOTH_OFF_AGREE ?? 0),
        "librosa≈madmom, both off GT → **Reference/definition** more likely",
      ],
      [
        "BOTH_OFF_DISAGREE",
        String(relationCounts.BOTH_OFF_DISAGREE ?? 0),
        "analyzers disagree & both off → ensemble only after reference clarity",
      ],
      [
        "LIBROSA_CLOSER",
        String(relationCounts.LIBROSA_CLOSER ?? 0),
        "librosa nearer GT",
      ],
      [
        "MADMOM_CLOSER",
        String(relationCounts.MADMOM_CLOSER ?? 0),
        "madmom nearer GT",
      ],
      [
        "BOTH_NEAR_GT",
        String(relationCounts.BOTH_NEAR_GT ?? 0),
        "both within ~50ms of GT phase",
      ],
    ]
  )
);
md.push(``);
md.push(
  `- Mean |librosa−madmom| phase distance: **${
    payload.summary.meanAnalyzerAgreeSec != null
      ? `${Math.round(payload.summary.meanAnalyzerAgreeSec * 1000)}ms`
      : "n/a"
  }**`
);
md.push(`- BOTH_OFF_AGREE songs: ${bothOffAgree.map((s) => s.songId.replace("song-", "")).join(", ") || "(none)"}`);
md.push(``);
md.push(`### Interpretation`);
md.push(``);
md.push(`- Support for Hyp **B** (Phase Reference): **${payload.interpretation.supportForHypothesisB}**`);
md.push(
  `- Support for Hyp **A/C** via phase-wander (abs high, signed≈0): **${payload.interpretation.supportForHypothesisA_or_C_wander}** (${wanderCount} songs)`
);
md.push(`- Fusion now: **${payload.interpretation.supportForFusionNow}**`);
md.push(`- More analyzer-swap: **${payload.interpretation.supportForMoreAnalyzerSwap}**`);
md.push(`- Mean |phase| : librosa **${payload.summary.meanLibrosaAbsMs}ms** · madmom **${payload.summary.meanMadmomAbsMs}ms**`);
md.push(`- Next layer: ${payload.interpretation.nextLayerHint}`);
md.push(``);
md.push(`## song-013 (Golden Case)`);
md.push(``);
if (song013) {
  md.push(
    mdTable(
      ["", "abs ms", "signed ms", "beats", "half-bin", "spread", "sign +/−/0"],
      [
        [
          "librosa",
          String(Math.round((song013.librosaBeat.medianAbsSec ?? 0) * 1000)),
          String(Math.round((song013.librosaBeat.medianSignedSec ?? 0) * 1000)),
          song013.librosaBeat.medianSignedBeats?.toFixed(2) ?? "—",
          song013.librosaBeat.halfBeatBin,
          song013.librosaBeat.phaseSpreadBeats?.toFixed(2) ?? "—",
          `${song013.librosaBeat.signMix.plus}/${song013.librosaBeat.signMix.minus}/${song013.librosaBeat.signMix.near0}`,
        ],
        [
          "madmom",
          String(Math.round((song013.madmomBeat.medianAbsSec ?? 0) * 1000)),
          String(Math.round((song013.madmomBeat.medianSignedSec ?? 0) * 1000)),
          song013.madmomBeat.medianSignedBeats?.toFixed(2) ?? "—",
          song013.madmomBeat.halfBeatBin,
          song013.madmomBeat.phaseSpreadBeats?.toFixed(2) ?? "—",
          `${song013.madmomBeat.signMix.plus}/${song013.madmomBeat.signMix.minus}/${song013.madmomBeat.signMix.near0}`,
        ],
      ]
    )
  );
  md.push(``);
  md.push(
    `- Analyzer agree |signed_L − signed_M|: **${
      song013.analyzerAgreeSec != null
        ? `${Math.round(song013.analyzerAgreeSec * 1000)}ms`
        : "n/a"
    }**`
  );
  md.push(`- Relation: **${song013.relation}**`);
  md.push(
    `- Phase wander flags: librosa=${song013.phaseWander.librosa} madmom=${song013.phaseWander.madmom}`
  );
  md.push(
    `- CountGrid vs GT beat phase0: ${
      song013.gt.countGridOffsetFromBeatSec != null
        ? `${Math.round(song013.gt.countGridOffsetFromBeatSec * 1000)}ms (${song013.gt.countGridHalfBin})`
        : "none"
    }`
  );
  for (const n of song013.notes) md.push(`- ${n}`);
}
md.push(``);
md.push(`## Per-song table`);
md.push(``);
md.push(
  mdTable(
    [
      "ID",
      "Title",
      "L abs ms",
      "L signed ms",
      "L bin",
      "M abs ms",
      "M signed ms",
      "M bin",
      "|L−M|",
      "Relation",
    ],
    songs.map((s) => [
      s.songId.replace("song-", ""),
      s.title.replace(/\|/g, "/"),
      s.librosaBeat.medianAbsSec != null
        ? String(Math.round(s.librosaBeat.medianAbsSec * 1000))
        : "—",
      s.librosaBeat.medianSignedSec != null
        ? String(Math.round(s.librosaBeat.medianSignedSec * 1000))
        : "—",
      s.librosaBeat.halfBeatBin,
      s.madmomBeat.medianAbsSec != null
        ? String(Math.round(s.madmomBeat.medianAbsSec * 1000))
        : "—",
      s.madmomBeat.medianSignedSec != null
        ? String(Math.round(s.madmomBeat.medianSignedSec * 1000))
        : "—",
      s.madmomBeat.halfBeatBin,
      s.analyzerAgreeSec != null
        ? String(Math.round(s.analyzerAgreeSec * 1000))
        : "—",
      s.relation,
    ])
  )
);
md.push(``);
md.push(`## CountGrid ↔ GT Beat Phase`);
md.push(``);
md.push(
  mdTable(
    ["ID", "CountGrid start", "offset ms", "bin"],
    songs.map((s) => [
      s.songId.replace("song-", ""),
      s.gt.countGridStartSec != null
        ? s.gt.countGridStartSec.toFixed(3)
        : "—",
      s.gt.countGridOffsetFromBeatSec != null
        ? String(Math.round(s.gt.countGridOffsetFromBeatSec * 1000))
        : "—",
      s.gt.countGridHalfBin,
    ])
  )
);
md.push(``);
md.push(`## Layer sketch (future — not implemented)`);
md.push(``);
md.push("```");
md.push(`Audio → Beat candidates (librosa / madmom / …)`);
md.push(`     → Music Evidence`);
md.push(`     → Beat Reference`);
md.push(`     → Dance Phase`);
md.push(`     → Count Grid`);
md.push(`     → Choreographic Timing`);
md.push("```");
md.push(``);
md.push(`## Decision`);
md.push(``);
md.push(`- ❌ Do not adopt madmom for Phase`);
md.push(`- ❌ Do not Fusion yet`);
md.push(`- ❌ Do not MSAF for this failure mode`);
md.push(`- ✅ Continue Phase Reference / Dance Phase definition work before more analyzers`);

writeFileSync(join(outDir, "phase-reference-audit.md"), md.join("\n") + "\n");

console.log(`Phase Reference Audit: ${songs.length} songs`);
console.log("relations", relationCounts);
console.log("Hyp B support", payload.interpretation.supportForHypothesisB);
console.log(
  "013",
  song013?.relation,
  "L abs",
  song013?.librosaBeat.medianAbsSec != null
    ? Math.round(song013.librosaBeat.medianAbsSec * 1000)
    : null,
  "M abs",
  song013?.madmomBeat.medianAbsSec != null
    ? Math.round(song013.madmomBeat.medianAbsSec * 1000)
    : null,
  "agree",
  song013?.analyzerAgreeSec != null
    ? Math.round(song013.analyzerAgreeSec * 1000)
    : null
);

/**
 * Phase 4.6 Real-Song Benchmark runner (analyzer-switchable).
 *
 * Beat eval: Period / Phase / Continuity / Evidence only (no pointwise F1).
 * GT: consensus.json for doubles, annotator-a.json otherwise.
 *
 * Usage:
 *   npm run fly:real-song-benchmark                 # librosa → real-song-benchmark-*
 *   npm run fly:real-song-benchmark -- --analyzer madmom
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStageAManifest } from "../fixtures/fly/real-song/manifest";
import { scoreSections, scoreTempo, scoreEvents } from "../src/lib/fly/benchmark/metrics";
import { annotationToFlyGroundTruth, hypothesisFileToFly } from "../src/lib/fly/realSong/bridge";
import {
  deriveBeatPattern,
  deriveDownbeatPattern,
} from "../src/lib/fly/realSong/beatPattern";
import {
  classifyBeatPattern,
  summarizeFindingClasses,
  type DimensionFinding,
  type FindingClass,
} from "../src/lib/fly/realSong/findingClass";
import {
  loadAllGroundTruth,
  resolveRealSongRoot,
} from "../src/lib/fly/realSong/loadGt";
import { scoreTimingPattern, type BeatPatternScore } from "../src/lib/fly/realSong/scoreBeatPattern";
import type { AnalyzerHypothesisFile } from "../src/lib/fly/realSong/types";
import {
  FLY_REAL_SONG_DATASET_VERSION,
  PHASE46_FREEZE,
} from "../src/lib/fly/realSong/versions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");
mkdirSync(outDir, { recursive: true });

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return null;
}

const ANALYZER = (argValue("--analyzer") ?? "librosa").toLowerCase();
const OUT_PREFIX =
  argValue("--out-prefix") ??
  (ANALYZER === "madmom"
    ? "real-song-benchmark-madmom"
    : "real-song-benchmark");

const PHASE_LOCKED = new Set(["song-013"]);

type SongBench = {
  songId: string;
  title: string;
  gtSource: "consensus" | "annotator-a";
  consensusReason: string | null;
  analyzerId: string;
  analyzerVersion: string;
  tempo: ReturnType<typeof scoreTempo>;
  beatPattern: BeatPatternScore;
  downbeatPattern: BeatPatternScore | null;
  section: ReturnType<typeof scoreSections>;
  event: ReturnType<typeof scoreEvents>;
  findings: DimensionFinding[];
  songClass: FindingClass;
};

function loadHyp(songId: string, analyzer: string): AnalyzerHypothesisFile | null {
  const path = join(resolveRealSongRoot(), "hypotheses", songId, `${analyzer}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as AnalyzerHypothesisFile;
}

function songClassFromFindings(findings: DimensionFinding[]): FindingClass {
  const order: FindingClass[] = ["PASS", "WEAK", "GT-AMBIGUITY", "ANALYZER-LIMIT"];
  let worst = 0;
  for (const f of findings) {
    const i = order.indexOf(f.findingClass);
    if (i > worst) worst = i;
  }
  return order[worst]!;
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

const manifests = Object.fromEntries(
  loadStageAManifest().map((m) => [m.songId, m])
);

const gts = loadAllGroundTruth();
const results: SongBench[] = [];

for (const gt of gts) {
  const hypFile = loadHyp(gt.songId, ANALYZER);
  if (!hypFile) {
    console.warn(`missing hyp for ${gt.songId} analyzer=${ANALYZER}`);
    continue;
  }
  const manifest = manifests[gt.songId] ?? {
    ...gt,
    songId: gt.songId,
    audioSha256: gt.audioSha256,
    sourceType: "AUTHORIZED_DATASET" as const,
    durationSec: gt.durationSec,
    conditions: {
      genre: ["unknown"],
      tempoClass: "MEDIUM" as const,
      beatDensity: "MEDIUM" as const,
      structureComplexity: "MEDIUM" as const,
      vocal: "VOCAL" as const,
      version: "ORIGINAL" as const,
    },
    annotationVersion: "1.1.0",
    annotators: ["consensus"],
    status: "ADJUDICATED" as const,
    datasetSplit: "DEVELOPMENT" as const,
    realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
    provenanceVersion: "1.1.0",
    selectionIntent: "golden20",
    doubleAnnotate: gt.doubleAnnotate,
    title: gt.title,
  };

  const flyGt = annotationToFlyGroundTruth(manifest, gt.annotation);
  flyGt.datasetVersion = FLY_REAL_SONG_DATASET_VERSION;
  flyGt.groundTruthVersion = `gt-${gt.gtSource}`;

  const hyp = hypothesisFileToFly(hypFile);
  const beatPat = deriveBeatPattern(gt.annotation, gt.durationSec);
  const downPat = deriveDownbeatPattern(gt.annotation, gt.durationSec);
  if (!beatPat) {
    console.warn(`no beat pattern for ${gt.songId}`);
    continue;
  }

  const beatPattern = scoreTimingPattern("beat", beatPat, hyp.beats);
  const downbeatPattern = downPat
    ? scoreTimingPattern("downbeat", downPat, hyp.downbeats)
    : null;

  const tempo = scoreTempo(gt.annotation.bpm, hyp.bpm ?? null);
  const section = scoreSections(flyGt.sections, hyp.sections ?? null);
  const event = scoreEvents(flyGt.events ?? null, hyp.events ?? null);

  const findings: DimensionFinding[] = [
    classifyBeatPattern({
      songId: gt.songId,
      title: gt.title,
      analyzerId: hyp.analyzerId,
      score: beatPattern,
      gtLockedPhasePolicy: PHASE_LOCKED.has(gt.songId),
    }),
  ];
  if (downbeatPattern) {
    findings.push(
      classifyBeatPattern({
        songId: gt.songId,
        title: gt.title,
        analyzerId: hyp.analyzerId,
        score: downbeatPattern,
        gtLockedPhasePolicy: PHASE_LOCKED.has(gt.songId),
      })
    );
  }

  let bpmClass: FindingClass = "PASS";
  if (tempo.status === "OK" && tempo.tempoClassError) bpmClass = "WEAK";
  findings.push({
    songId: gt.songId,
    title: gt.title,
    analyzerId: hyp.analyzerId,
    dimension: "BPM",
    findingClass: bpmClass,
    score: tempo.tempoClassError === false ? 1 : tempo.tempoClassError ? 0 : null,
    evidence: `rel%=${tempo.relativeErrorPercent?.toFixed(1) ?? "n/a"} equiv=${tempo.equivalenceRatio ?? "none"}`,
  });

  // Section: madmom Experiment B has sections=null → NOT_AVAILABLE / WEAK informational
  const secScore = section.labelF1;
  let secClass: FindingClass = "PASS";
  if (section.status !== "OK" || secScore == null || secScore < 0.55) {
    secClass = "WEAK";
  }
  findings.push({
    songId: gt.songId,
    title: gt.title,
    analyzerId: hyp.analyzerId,
    dimension: "SECTION",
    findingClass: secClass,
    score: secScore,
    evidence:
      section.status !== "OK"
        ? `section ${section.status} (Experiment B: Beat/Downbeat only — not MSAF)`
        : `labelF1=${secScore?.toFixed(3) ?? "n/a"} (informational)`,
  });

  const primaryFindings = findings.filter(
    (f) => f.dimension === "BEAT" || f.dimension === "BPM"
  );
  results.push({
    songId: gt.songId,
    title: gt.title,
    gtSource: gt.gtSource,
    consensusReason: gt.consensusReason,
    analyzerId: hyp.analyzerId,
    analyzerVersion: hyp.analyzerVersion,
    tempo,
    beatPattern,
    downbeatPattern,
    section,
    event,
    findings,
    songClass: songClassFromFindings(primaryFindings),
  });
}

const allFindings = results.flatMap((r) => r.findings);
const classCounts = summarizeFindingClasses(allFindings);
const beatFindings = allFindings.filter((f) => f.dimension === "BEAT");
const beatClassCounts = summarizeFindingClasses(beatFindings);
const song013 = results.find((r) => r.songId === "song-013");

const axisPass = (axis: "period" | "phase" | "continuity" | "evidence") =>
  results.filter((r) => r.beatPattern[axis].verdict === "PASS").length;

const payload = {
  gate: ANALYZER === "madmom" ? "EXPERIMENT_B" : "GO",
  experimentId: ANALYZER === "madmom" ? "4.6-exp-madmom-beat-v1" : null,
  benchmarkGate: ANALYZER === "madmom" ? "EXPERIMENT_B_COMPLETE" : "GO",
  analyzerUnderTest: ANALYZER,
  realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
  computedAt: new Date().toISOString(),
  axisPassCounts: {
    period: axisPass("period"),
    phase: axisPass("phase"),
    continuity: axisPass("continuity"),
    evidence: axisPass("evidence"),
    n: results.length,
  },
  beatFindingClassCounts: beatClassCounts,
  findingClassCounts: classCounts,
  freeze: PHASE46_FREEZE,
  contract: {
    beatAxes: ["Period", "Phase", "Continuity", "Evidence"],
    forbidden: [
      "pointwise Beat F1",
      "seed density as accuracy",
      "continuation point competition",
      "BPM-only phase pass",
      "A/B disagreement as analyzer error",
      "GT retargeted to analyzer",
      "fusion during experiment B",
    ],
    song013PhasePolicy:
      "half-beat offset is phase-start error, not dual-phase GT; consensus seed=B",
  },
  song013: song013
    ? {
        title: song013.title,
        gtSource: song013.gtSource,
        beat: {
          period: song013.beatPattern.period,
          phase: song013.beatPattern.phase,
          continuity: song013.beatPattern.continuity,
          evidence: song013.beatPattern.evidence,
          aggregate: song013.beatPattern.aggregateScore,
          notes: song013.beatPattern.notes,
        },
        findings: song013.findings,
        songClass: song013.songClass,
      }
    : null,
  songs: results.map((r) => ({
    songId: r.songId,
    title: r.title,
    gtSource: r.gtSource,
    songClass: r.songClass,
    bpm: {
      human: r.tempo.humanBpm,
      hyp: r.tempo.hypBpm,
      relPct: r.tempo.relativeErrorPercent,
      equiv: r.tempo.equivalenceRatio,
      classError: r.tempo.tempoClassError,
    },
    beat: {
      periodVerdict: r.beatPattern.period.verdict,
      periodRelErr: r.beatPattern.period.relativeError,
      phaseVerdict: r.beatPattern.phase.verdict,
      phaseMedMs:
        r.beatPattern.phase.medianAbsErrorSec != null
          ? Math.round(r.beatPattern.phase.medianAbsErrorSec * 1000)
          : null,
      halfBeatRatio: r.beatPattern.phase.halfBeatRatio,
      continuityVerdict: r.beatPattern.continuity.verdict,
      lockFraction: r.beatPattern.continuity.lockFraction,
      evidenceVerdict: r.beatPattern.evidence.verdict,
      hypInWindow: r.beatPattern.evidence.hypCountInWindow,
      gtSeeds: r.beatPattern.evidence.gtSeedCount,
      aggregate: r.beatPattern.aggregateScore,
    },
    sectionLabelF1: r.section.labelF1,
    findings: r.findings.map((f) => ({
      dimension: f.dimension,
      class: f.findingClass,
      score: f.score,
      evidence: f.evidence,
    })),
  })),
};

writeFileSync(
  join(outDir, `${OUT_PREFIX}-result.json`),
  JSON.stringify(payload, null, 2) + "\n",
  "utf8"
);

const md: string[] = [];
md.push(`# FLY Real-Song Benchmark — ${ANALYZER}`);
md.push(``);
md.push(`**Gate:** ${payload.gate}`);
md.push(`**dataset:** \`${FLY_REAL_SONG_DATASET_VERSION}\``);
md.push(`**analyzer:** \`${ANALYZER}\``);
md.push(`**songs scored:** ${results.length}/20`);
md.push(``);
md.push(`## Axis PASS counts (Beat Pattern)`);
md.push(``);
md.push(
  mdTable(
    ["Period PASS", "Phase PASS", "Continuity PASS", "Evidence PASS", "n"],
    [
      [
        String(payload.axisPassCounts.period),
        String(payload.axisPassCounts.phase),
        String(payload.axisPassCounts.continuity),
        String(payload.axisPassCounts.evidence),
        String(payload.axisPassCounts.n),
      ],
    ]
  )
);
md.push(``);
md.push(`## Beat finding classes`);
md.push(``);
md.push(
  mdTable(
    ["PASS", "WEAK", "GT-AMBIGUITY", "ANALYZER-LIMIT"],
    [
      [
        String(beatClassCounts.PASS),
        String(beatClassCounts.WEAK),
        String(beatClassCounts["GT-AMBIGUITY"]),
        String(beatClassCounts["ANALYZER-LIMIT"]),
      ],
    ]
  )
);
md.push(``);
md.push(`## song-013`);
md.push(``);
if (song013) {
  const p = song013.beatPattern;
  md.push(
    `- Period **${p.period.verdict}** · Phase **${p.phase.verdict}** (${
      p.phase.medianAbsErrorSec != null
        ? Math.round(p.phase.medianAbsErrorSec * 1000)
        : "n/a"
    }ms) · Continuity **${p.continuity.verdict}** · Evidence **${p.evidence.verdict}**`
  );
  md.push(`- Song class: **${song013.songClass}**`);
}
md.push(``);
md.push(`## Per-song`);
md.push(``);
md.push(
  mdTable(
    ["ID", "Title", "Period", "Phase ms", "Phase", "Cont", "Evid", "Class"],
    results.map((r) => [
      r.songId.replace("song-", ""),
      r.title.replace(/\|/g, "/"),
      r.beatPattern.period.verdict,
      r.beatPattern.phase.medianAbsErrorSec != null
        ? String(Math.round(r.beatPattern.phase.medianAbsErrorSec * 1000))
        : "—",
      r.beatPattern.phase.verdict,
      r.beatPattern.continuity.verdict,
      r.beatPattern.evidence.verdict,
      r.songClass,
    ])
  )
);
md.push(``);
md.push(`## Notes`);
md.push(``);
md.push(`- No Fusion · No MSAF · librosa baseline untouched`);
md.push(`- Formal adoption is a separate human decision after A/B compare`);

writeFileSync(join(outDir, `${OUT_PREFIX}-report.md`), md.join("\n") + "\n", "utf8");

console.log(
  `Benchmark ${ANALYZER}: ${results.length} songs → ${OUT_PREFIX}-report.md`
);
console.log("Beat classes", beatClassCounts);
console.log("Axis PASS", payload.axisPassCounts);
if (song013) {
  console.log(
    "013 phase",
    song013.beatPattern.phase.verdict,
    "ms",
    song013.beatPattern.phase.medianAbsErrorSec != null
      ? Math.round(song013.beatPattern.phase.medianAbsErrorSec * 1000)
      : null
  );
}

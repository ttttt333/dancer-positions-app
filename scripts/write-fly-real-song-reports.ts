/**
 * Writes Stage A status + optional pilot pipeline reports.
 * Usage: npm run fly:real-song-reports
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadStageAManifest,
  stageACoverageSummary,
} from "../fixtures/fly/real-song/manifest";
import {
  annotationToFlyGroundTruth,
  hypothesisFileToFly,
  runRealSongBenchmarkPipeline,
  PHASE46_FREEZE,
} from "../src/lib/fly/realSong";
import {
  pilotAnnotatorA,
} from "../fixtures/fly/real-song/examples/pilotAnnotations";
import {
  FLY_ANNOTATION_CONTRACT_VERSION,
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_REAL_SONG_PROVENANCE_VERSION,
} from "../src/lib/fly/realSong/versions";
import type { RealSongManifest } from "../src/lib/fly/realSong/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");
mkdirSync(outDir, { recursive: true });

const manifests = loadStageAManifest();
const cov = stageACoverageSummary(manifests);
const annotated = manifests.filter((m) => m.status !== "UNANNOTATED");

const statusMd = `# FLY Real-Song Stage A Status

- real_song_dataset_version: \`${FLY_REAL_SONG_DATASET_VERSION}\`
- registered songs: **${manifests.length}**
- annotated songs: **${annotated.length}**
- status: ${annotated.length === 0 ? "**UNANNOTATED — awaiting human GT**" : "partial"}

## FREEZE

${PHASE46_FREEZE.map((f) => `- ${f}`).join("\n")}

## Coverage

- genres: ${cov.genres.join(", ")}
- tempos: ${cov.tempos.join(", ")}
- densities: ${cov.densities.join(", ")}
- complexities: ${cov.complexities.join(", ")}
- double-annotate: ${cov.doubleAnnotateSongIds.join(", ")}
- splits: DEV ${cov.splits.DEVELOPMENT} / VAL ${cov.splits.VALIDATION} / HOLD ${cov.splits.HOLDOUT}

## LOW SAMPLE SIZE

Do **not** claim analyzer accuracy until human GT exists for Stage A.
Pilot schema reports below are **format checks only**.

## Next human steps

1. Place authorized audio locally (see \`fixtures/fly/real-song/audio/README.md\`)
2. Replace \`PENDING_*\` with sha256
3. Annotate human-first (no analyzer locking)
4. Double-annotate: ${cov.doubleAnnotateSongIds.join(", ")}
5. Re-run \`npm run fly:real-song-reports\`
`;

writeFileSync(join(outDir, "real-song-stage-a-status.md"), statusMd, "utf8");

// Pilot-only pipeline demo (not Stage A claims)
const pilotManifest: RealSongManifest = {
  songId: pilotAnnotatorA.songId,
  audioSha256: pilotAnnotatorA.audioSha256,
  sourceType: "USER_OWNED",
  durationSec: 32,
  conditions: {
    genre: ["pilot"],
    tempoClass: "MEDIUM",
    beatDensity: "MEDIUM",
    structureComplexity: "SIMPLE",
    vocal: "VOCAL",
    version: "ORIGINAL",
  },
  annotationVersion: FLY_ANNOTATION_CONTRACT_VERSION,
  annotators: ["annotator-a"],
  status: "ANNOTATED",
  datasetSplit: "DEVELOPMENT",
  realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
  provenanceVersion: FLY_REAL_SONG_PROVENANCE_VERSION,
  selectionIntent: "schema pilot only",
  doubleAnnotate: false,
};

const gt = annotationToFlyGroundTruth(pilotManifest, pilotAnnotatorA);
const bundle = runRealSongBenchmarkPipeline([
  {
    groundTruth: gt,
    hypotheses: [
      hypothesisFileToFly({
        songId: pilotAnnotatorA.songId,
        audioSha256: pilotAnnotatorA.audioSha256,
        analyzerId: "librosa",
        analyzerVersion: "pilot",
        producedAt: new Date().toISOString(),
        bpm: 120,
        beats: pilotAnnotatorA.beats,
        sections: pilotAnnotatorA.sections,
      }),
      hypothesisFileToFly({
        songId: pilotAnnotatorA.songId,
        audioSha256: pilotAnnotatorA.audioSha256,
        analyzerId: "essentia",
        analyzerVersion: "pilot",
        producedAt: new Date().toISOString(),
        bpm: 120,
        beats: pilotAnnotatorA.beats.map((t) => t + 0.02),
        sections: [
          { startSec: 0, endSec: 8, label: "INTRO", confidence: 0.8 },
          { startSec: 8, endSec: 32, label: "VERSE", confidence: 0.4 },
        ],
      }),
    ],
  },
]);

writeFileSync(
  join(outDir, "real-song-benchmark-report.md"),
  bundle.reports.benchmarkMarkdown +
    "\n\n> Pilot schema only — Stage A human GT not complete.\n",
  "utf8"
);
writeFileSync(
  join(outDir, "real-song-benchmark-result.json"),
  JSON.stringify(
    {
      note: "pilot_schema_only",
      stageAAnnotated: annotated.length,
      ...JSON.parse(bundle.benchmark.reports.json),
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(join(outDir, "weakness-report.md"), bundle.reports.weaknessMarkdown, "utf8");
writeFileSync(join(outDir, "weakness-report.json"), bundle.reports.weaknessJson, "utf8");
writeFileSync(
  join(outDir, "analyzer-reliability-map.json"),
  bundle.reports.reliabilityMapJson,
  "utf8"
);

console.log(`Stage A registered=${manifests.length} annotated=${annotated.length}`);
console.log(`Wrote reports → ${outDir}`);

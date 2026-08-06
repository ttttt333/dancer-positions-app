#!/usr/bin/env node
/**
 * モック変化点で generateFormations を叩く簡易確認スクリプト
 * 実行: npx tsx src/lib/choreocore/smoke.mjs
 * または: node --experimental-strip-types は使わず vitest を推奨
 */
import {
  generateFormations,
  type ChangePoint,
  type Formation,
} from "./index.ts";

const bpm = 128;
const initial: Formation = {
  id: "init",
  performers: Array.from({ length: 25 }, (_, i) => ({
    id: `p${i}`,
    position: { x: -5 + (i / 24) * 10, y: 0 },
  })),
};

const changePoints: ChangePoint[] = Array.from({ length: 12 }, (_, i) => ({
  eight_index: (i + 1) * 2,
  time: (i + 1) * 2 * (60 / bpm) * 8,
  score: 0.4 + (i % 3) * 0.15,
  tier: (["minor", "medium", "major"] as const)[i % 3],
}));

const result = generateFormations(changePoints, initial, bpm, {
  durationSec: 180,
  songDynamism: 0.6,
});

console.log(
  JSON.stringify(
    {
      formations: result.formations.length,
      cues: result.cues.length,
      sampleReasoning: result.reasoning.slice(0, 5),
      firstCue: result.cues[0],
      lastCue: result.cues[result.cues.length - 1],
    },
    null,
    2
  )
);

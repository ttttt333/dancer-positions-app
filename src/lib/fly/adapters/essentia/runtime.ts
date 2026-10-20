/**
 * Pluggable Essentia runtimes.
 * Default CI path: deterministic mock (no WASM).
 * Optional: dynamic import("essentia.js") when installed + flag ON.
 */

import { ESSENTIA_ERROR, EssentiaAdapterError } from "./errors";
import {
  ESSENTIA_ALGO_VERSION_JS,
  ESSENTIA_ALGO_VERSION_MOCK,
  type EssentiaRawResult,
  type EssentiaRuntime,
} from "./types";

/** Deterministic pseudo-Essentia for tests / CI */
export function createMockEssentiaRuntime(opts?: {
  bpm?: number;
}): EssentiaRuntime {
  const bpm = opts?.bpm ?? 120;
  return {
    id: "mock",
    version: ESSENTIA_ALGO_VERSION_MOCK,
    available: true,
    async analyze(samples, sampleRate) {
      if (!samples?.length || !(sampleRate > 0)) {
        throw new EssentiaAdapterError(
          ESSENTIA_ERROR.UNSUPPORTED_AUDIO,
          "empty or invalid PCM"
        );
      }
      const duration = samples.length / sampleRate;
      const beatDur = 60 / bpm;
      const beats: number[] = [];
      for (let t = 0; t < duration - 1e-6; t += beatDur) {
        beats.push(Math.round(t * 1000) / 1000);
      }
      // Onsets ≈ beats (Phase 4: store only; Dance Intelligence unused)
      const onsets = beats.map((time) => ({ time, strength: 0.7 }));
      // No downbeats invented
      const raw: EssentiaRawResult = {
        bpm,
        bpmConfidence: 0.9,
        beats,
        beatConfidences: beats.map(() => 0.85),
        downbeats: null,
        onsets,
        runtimeId: "mock",
        runtimeVersion: ESSENTIA_ALGO_VERSION_MOCK,
      };
      return raw;
    },
  };
}

export function createUnavailableEssentiaRuntime(
  reason = "essentia runtime not loaded"
): EssentiaRuntime {
  return {
    id: "unavailable",
    version: "none",
    available: false,
    async analyze() {
      throw new EssentiaAdapterError(ESSENTIA_ERROR.UNAVAILABLE, reason);
    },
  };
}

/**
 * Attempt dynamic load of essentia.js (optional peer).
 * Never bundled by default — returns unavailable on failure.
 */
export async function tryLoadEssentiaJsRuntime(): Promise<EssentiaRuntime> {
  try {
    const modName = "essentia.js";
    const mod = (await import(/* @vite-ignore */ modName)) as {
      EssentiaWASM?: () => Promise<unknown>;
      Essentia?: new (wasm: unknown) => EssentiaJsInstance;
      default?: {
        EssentiaWASM?: () => Promise<unknown>;
        Essentia?: new (wasm: unknown) => EssentiaJsInstance;
      };
    };
    const EssentiaWASM = mod.EssentiaWASM ?? mod.default?.EssentiaWASM;
    const Essentia = mod.Essentia ?? mod.default?.Essentia;
    if (!EssentiaWASM || !Essentia) {
      return createUnavailableEssentiaRuntime("essentia.js exports missing");
    }
    const wasm = await EssentiaWASM();
    const essentia = new Essentia(wasm);
    return {
      id: "essentia.js",
      version: ESSENTIA_ALGO_VERSION_JS,
      available: true,
      async analyze(samples, sampleRate) {
        try {
          const vector = essentia.arrayToVector(samples);
          // RhythmExtractor2013: [bpm, ticks, confidence, estimates, bpmIntervals]
          const rhythm = essentia.RhythmExtractor2013(vector) as Record<
            string,
            unknown
          > &
            unknown[];
          const bpm = Number(rhythm.bpm ?? rhythm[0] ?? 0) || null;
          const ticksRaw = rhythm.ticks ?? rhythm[1];
          const beats = vectorLikeToArray(ticksRaw);
          const confidence = Number(rhythm.confidence ?? rhythm[2] ?? 0.5);
          let onsets: Array<{ time: number; strength: number }> | null = null;
          try {
            const onset = essentia.OnsetRate(vector) as Record<string, unknown> &
              unknown[];
            const times = vectorLikeToArray(onset.onsets ?? onset[0]);
            onsets = times.map((time) => ({ time, strength: 0.6 }));
          } catch {
            onsets = null;
          }
          try {
            essentia.delete?.();
          } catch {
            /* ignore */
          }
          return {
            bpm,
            bpmConfidence: confidence,
            beats: beats.length ? beats : null,
            beatConfidences: beats.length
              ? beats.map(() => clamp01(confidence))
              : null,
            downbeats: null,
            onsets,
            runtimeId: "essentia.js",
            runtimeVersion: ESSENTIA_ALGO_VERSION_JS,
          } satisfies EssentiaRawResult;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/wasm|WebAssembly/i.test(msg)) {
            throw new EssentiaAdapterError(ESSENTIA_ERROR.WASM, msg, e);
          }
          if (/memory|OOM/i.test(msg)) {
            throw new EssentiaAdapterError(ESSENTIA_ERROR.MEMORY, msg, e);
          }
          throw new EssentiaAdapterError(ESSENTIA_ERROR.RUNTIME, msg, e);
        } finally {
          void sampleRate;
        }
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return createUnavailableEssentiaRuntime(`essentia.js load failed: ${msg}`);
  }
}

type EssentiaJsInstance = {
  arrayToVector: (samples: Float32Array) => unknown;
  RhythmExtractor2013: (vector: unknown) => unknown;
  OnsetRate: (vector: unknown) => unknown;
  delete?: () => void;
};

function vectorLikeToArray(v: unknown): number[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter((n) => Number.isFinite(n));
  if (typeof v === "object" && v !== null && "size" in v && "get" in v) {
    const sized = v as { size: () => number; get: (i: number) => number };
    const n = sized.size();
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(Number(sized.get(i)));
    return out.filter((x) => Number.isFinite(x));
  }
  if (typeof Float32Array !== "undefined" && v instanceof Float32Array) {
    return Array.from(v);
  }
  return [];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

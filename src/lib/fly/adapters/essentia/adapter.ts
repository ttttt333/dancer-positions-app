import type { FlyAnalyzerAdapter, FlyAudioInput, FlyAnalyzerResult } from "../types";
import { isFlyEssentiaEnabledResolved } from "../../featureFlags";
import { essentiaCapabilitiesForResult } from "./capabilities";
import { ESSENTIA_ERROR, EssentiaAdapterError } from "./errors";
import { mapEssentiaRawToFlyAnalyzerResult } from "./mapper";
import {
  createMockEssentiaRuntime,
  createUnavailableEssentiaRuntime,
  tryLoadEssentiaJsRuntime,
} from "./runtime";
import {
  ESSENTIA_ADAPTER_ID,
  ESSENTIA_ADAPTER_VERSION,
  type EssentiaRuntime,
} from "./types";

export type EssentiaAdapterOptions = {
  /** Inject runtime (tests). Default: mock when flag on, else unavailable. */
  runtime?: EssentiaRuntime;
  /** Prefer real essentia.js when flag on (async resolve). */
  preferWasm?: boolean;
  /** Force analyze even if feature flag is off (unit tests). */
  ignoreFeatureFlag?: boolean;
};

export class EssentiaAnalyzerAdapter implements FlyAnalyzerAdapter {
  readonly id = ESSENTIA_ADAPTER_ID;
  readonly version = ESSENTIA_ADAPTER_VERSION;
  capabilities = essentiaCapabilitiesForResult(false);

  private runtime: EssentiaRuntime | null;
  private preferWasm: boolean;
  private ignoreFeatureFlag: boolean;
  private initPromise: Promise<EssentiaRuntime> | null = null;

  constructor(opts: EssentiaAdapterOptions = {}) {
    this.runtime = opts.runtime ?? null;
    this.preferWasm = opts.preferWasm ?? false;
    this.ignoreFeatureFlag = opts.ignoreFeatureFlag ?? false;
  }

  async ensureRuntime(): Promise<EssentiaRuntime> {
    if (this.runtime) return this.runtime;
    if (!this.initPromise) {
      this.initPromise = this.resolveRuntime();
    }
    this.runtime = await this.initPromise;
    return this.runtime;
  }

  private async resolveRuntime(): Promise<EssentiaRuntime> {
    if (!this.ignoreFeatureFlag && !isFlyEssentiaEnabledResolved()) {
      return createUnavailableEssentiaRuntime("FLY_ESSENTIA disabled");
    }
    if (this.preferWasm) {
      const wasm = await tryLoadEssentiaJsRuntime();
      if (wasm.available) return wasm;
    }
    // Safe default for CI / flag-on without package: deterministic mock
    return createMockEssentiaRuntime();
  }

  async analyze(audio: FlyAudioInput): Promise<FlyAnalyzerResult> {
    const analyzedAt = new Date().toISOString();
    try {
      if (!this.ignoreFeatureFlag && !isFlyEssentiaEnabledResolved()) {
        return failureResult(
          ESSENTIA_ERROR.DISABLED,
          "Essentia feature flag is off",
          analyzedAt
        );
      }
      if (
        !audio?.samples?.length ||
        !(audio.sampleRate > 0) ||
        !(audio.durationSeconds > 0)
      ) {
        return failureResult(
          ESSENTIA_ERROR.UNSUPPORTED_AUDIO,
          "unsupported or empty FlyAudioInput",
          analyzedAt
        );
      }

      const runtime = await this.ensureRuntime();
      if (!runtime.available) {
        return failureResult(
          ESSENTIA_ERROR.UNAVAILABLE,
          "Essentia runtime unavailable",
          analyzedAt
        );
      }

      const raw = await runtime.analyze(audio.samples, audio.sampleRate);
      const mapped = mapEssentiaRawToFlyAnalyzerResult(raw, { analyzedAt });
      this.capabilities = mapped.meta.capabilities;
      return mapped;
    } catch (e) {
      if (e instanceof EssentiaAdapterError) {
        return failureResult(e.code, e.message, analyzedAt);
      }
      const msg = e instanceof Error ? e.message : String(e);
      return failureResult(ESSENTIA_ERROR.RUNTIME, msg, analyzedAt);
    }
  }
}

function failureResult(
  code: string,
  message: string,
  analyzedAt: string
): FlyAnalyzerResult {
  return {
    analyzerId: ESSENTIA_ADAPTER_ID,
    adapterVersion: ESSENTIA_ADAPTER_VERSION,
    meta: {
      source: ESSENTIA_ADAPTER_ID,
      version: "none",
      analyzedAt,
      capabilities: [],
    },
    ok: false,
    errorCode: code,
    errorMessage: message,
    tempo: null,
    beat: null,
    downbeats: null,
    onsets: null,
    provenance: [],
  };
}

export function createEssentiaAdapter(
  opts?: EssentiaAdapterOptions
): EssentiaAnalyzerAdapter {
  return new EssentiaAnalyzerAdapter(opts);
}

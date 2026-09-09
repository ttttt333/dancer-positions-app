export const ESSENTIA_ADAPTER_ID = "essentia";
export const ESSENTIA_ADAPTER_VERSION = "fly-essentia-adapter-v0.1.0";
/** Logical algorithm version when using mock / unavailable runtimes */
export const ESSENTIA_ALGO_VERSION_MOCK = "essentia-mock-v0.1.0";
export const ESSENTIA_ALGO_VERSION_JS = "essentia.js@0.1.x";

export type EssentiaRawResult = {
  bpm?: number | null;
  bpmConfidence?: number | null;
  beats?: number[] | null;
  beatConfidences?: number[] | null;
  downbeats?: number[] | null;
  downbeatConfidences?: number[] | null;
  onsets?: Array<{ time: number; strength?: number }> | null;
  runtimeId: "mock" | "essentia.js" | "unavailable";
  runtimeVersion: string;
};

export type EssentiaRuntime = {
  id: "mock" | "essentia.js" | "unavailable";
  version: string;
  available: boolean;
  analyze(samples: Float32Array, sampleRate: number): Promise<EssentiaRawResult>;
};

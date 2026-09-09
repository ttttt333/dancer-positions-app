export class EssentiaAdapterError extends Error {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "EssentiaAdapterError";
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export const ESSENTIA_ERROR = {
  UNAVAILABLE: "essentia_unavailable",
  TIMEOUT: "essentia_timeout",
  RUNTIME: "essentia_runtime_error",
  UNSUPPORTED_AUDIO: "essentia_unsupported_audio",
  WASM: "essentia_wasm_error",
  MEMORY: "essentia_memory_error",
  DISABLED: "essentia_disabled",
} as const;

export type AudioAnalysisErrorCode =
  | "EMPTY_BUFFER"
  | "ZERO_DURATION"
  | "INVALID_SAMPLE_RATE"
  | "INVALID_CHANNELS"
  | "FRAME_TOO_SHORT"
  | "FFT_INVALID"
  | "DECODE_FAILED";

export class AudioAnalysisError extends Error {
  readonly code: AudioAnalysisErrorCode;

  constructor(code: AudioAnalysisErrorCode, message: string) {
    super(message);
    this.name = "AudioAnalysisError";
    this.code = code;
  }
}

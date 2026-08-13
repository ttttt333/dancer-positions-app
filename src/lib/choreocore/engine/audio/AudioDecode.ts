import { decodeArrayBufferToAudioBuffer } from "../../../audioContext";
import { AudioAnalysisError } from "../types/AudioError";

/**
 * Browser decode only. Reuses the shared AudioContext path already used by
 * waveform import — do not instantiate a second decoder stack.
 */
export async function decodeAudio(
  input: ArrayBuffer | Blob
): Promise<AudioBuffer> {
  let buffer: ArrayBuffer;
  try {
    buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AudioAnalysisError(
      "DECODE_FAILED",
      `Failed to read audio bytes: ${message}`
    );
  }

  if (buffer.byteLength === 0) {
    throw new AudioAnalysisError("EMPTY_BUFFER", "Audio input is empty (0 bytes)");
  }

  try {
    const decoded = await decodeArrayBufferToAudioBuffer(buffer);
    if (!decoded || decoded.length <= 0) {
      throw new AudioAnalysisError(
        "ZERO_DURATION",
        "Decoded AudioBuffer has no samples"
      );
    }
    return decoded;
  } catch (err) {
    if (err instanceof AudioAnalysisError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AudioAnalysisError(
      "DECODE_FAILED",
      `decodeAudioData failed: ${message}`
    );
  }
}

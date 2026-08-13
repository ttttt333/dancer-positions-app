export type FrequencyBandEnergy = {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
};

/**
 * Per-hop audio features. All band energies are RMS in linear amplitude (not dB).
 * Kept independent of Web Audio so Node/Vitest can feed synthetic buffers.
 */
export type AudioFeatureFrame = {
  time: number;
  rms: number;
  spectralFlux: number;
  spectralCentroid: number;
  bassEnergy: number;
  lowMidEnergy: number;
  midEnergy: number;
  highMidEnergy: number;
  highEnergy: number;
  onsetStrength: number;
};

export type BeatEvent = {
  time: number;
  index: number;
  strength: number;
  beatInBar: number;
  barIndex: number;
};

export type TempoAnalysis = {
  bpm: number;
  confidence: number;
};

/**
 * Minimal AudioBuffer-compatible input. Real Web Audio AudioBuffer satisfies this.
 * Avoids coupling the engine to DOM-only AudioBuffer methods.
 */
export type EngineAudioBuffer = {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  duration: number;
  getChannelData: (channel: number) => Float32Array;
};

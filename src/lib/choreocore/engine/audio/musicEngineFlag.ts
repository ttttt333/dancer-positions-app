/**
 * Real Phase 1/2 を本番へ載せるゲート。未設定は OFF（現行 RMS + 4エイト）。
 * `"1"` / `"true"` / `"on"` で ON。
 */

let testOverride: boolean | undefined;

/** テスト専用。undefined で本番の env 判定に戻す。 */
export function setMusicEnginePhase12EnabledForTests(
  value: boolean | undefined
): void {
  testOverride = value;
}

export function isMusicEnginePhase12Enabled(): boolean {
  if (testOverride !== undefined) return testOverride;
  const raw = String(import.meta.env.VITE_MUSIC_ENGINE_PHASE12 ?? "0")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

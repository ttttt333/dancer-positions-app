/**
 * リモート音源ロード時の波形キャッシュ操作を一箇所に集約。
 * （表示ガードは `wavePeaksSession`、デコード本体は `useTimelineWaveDecode`）
 */
export {
  ensureServerPeaksOnly,
  ensureSupabasePeaksOnly,
  hasWavePeaksInStore,
  rebindUsablePeaksToCacheKey,
  sidecarPeaksAreUsable,
  tryApplyCachedPeaksEarly,
  tryApplyCachedPeaksFromStore,
} from "./wavePeaksLoader";

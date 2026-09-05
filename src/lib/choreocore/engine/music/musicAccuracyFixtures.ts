/**
 * Golden-track 評価セット（Stage 6）。
 * 音源ファイルは置かない。期待時刻の契約だけ。優劣はまだ断定しない。
 */
import type { MusicAccuracyCase } from "./productionTimeline";

export const MUSIC_ACCURACY_CASES: MusicAccuracyCase[] = [
  {
    id: "synthetic-chorus-32",
    expected: { chorusStartSec: 32, preChorusSec: 24 },
  },
  {
    id: "synthetic-drop-48",
    expected: { dropSec: 48, chorusStartSec: 32, majorTransitionSec: 48 },
  },
];

export const PILOT_ANNOTATORS = [
  "choreographer-a",
  "choreographer-b",
  "choreographer-c",
] as const;

export const CALIBRATION_SONG_IDS = ["real-001", "real-002"] as const;

export type PilotSongCard = {
  id: string;
  title: string;
  bpm: number;
  duration: number;
  category: string;
  difficulty: string;
  structure: string;
};

export const PILOT_SONGS: PilotSongCard[] = [
  { id: "real-001", title: "Pilot 01 — Gradual Energy Rise", bpm: 96, duration: 210, category: "ENERGY_DRIVEN", difficulty: "MEDIUM", structure: "Energyが徐々に上昇" },
  { id: "real-002", title: "Pilot 02 — Chorus Energy Lift", bpm: 118, duration: 195, category: "ENERGY_DRIVEN", difficulty: "EASY", structure: "サビで一気にEnergy上昇" },
  { id: "real-003", title: "Pilot 03 — Strong Drop", bpm: 128, duration: 200, category: "DROP_HEAVY", difficulty: "MEDIUM", structure: "強いDrop" },
  { id: "real-004", title: "Pilot 04 — Long Break", bpm: 110, duration: 240, category: "DROP_HEAVY", difficulty: "HARD", structure: "長いBreak" },
  { id: "real-005", title: "Pilot 05 — Hit Dense", bpm: 132, duration: 185, category: "BEAT_DRIVEN", difficulty: "MEDIUM", structure: "Hitが多い" },
  { id: "real-006", title: "Pilot 06 — Quiet / Explosion / Quiet", bpm: 124, duration: 220, category: "COMPLEX_STRUCTURE", difficulty: "HARD", structure: "静→爆発→静" },
  { id: "real-007", title: "Pilot 07 — Complex Form", bpm: 108, duration: 260, category: "COMPLEX_STRUCTURE", difficulty: "VERY_HARD", structure: "複雑な構造" },
  { id: "real-008", title: "Pilot 08 — High BPM", bpm: 168, duration: 170, category: "BEAT_DRIVEN", difficulty: "HARD", structure: "高BPM" },
  { id: "real-009", title: "Pilot 09 — Low BPM", bpm: 72, duration: 230, category: "MINIMAL_STABLE", difficulty: "EASY", structure: "低BPM" },
  { id: "real-010", title: "Pilot 10 — Minimal / Few Changes", bpm: 88, duration: 200, category: "MINIMAL_STABLE", difficulty: "EASY", structure: "Minimal / 変化少なめ" },
];

export const SECTION_TYPES = [
  "INTRO",
  "VERSE",
  "PRE_CHORUS",
  "CHORUS",
  "DROP",
  "BREAK",
  "BRIDGE",
  "FINAL_CHORUS",
  "OUTRO",
  "UNKNOWN",
] as const;

export const CUE_ACTIONS = [
  "HOLD",
  "MICRO_SHIFT",
  "EXPAND",
  "CONTRACT",
  "SPLIT",
  "MERGE",
  "CENTER",
  "MAJOR_CHANGE",
] as const;

export const CUE_MAGNITUDES = ["NONE", "SMALL", "MEDIUM", "LARGE", "MAX"] as const;

export const SECTION_TYPE_JA: Record<string, string> = {
  INTRO: "イントロ",
  VERSE: "バース",
  PRE_CHORUS: "プレサビ",
  CHORUS: "サビ",
  DROP: "ドロップ",
  BREAK: "ブレイク",
  BRIDGE: "ブリッジ",
  FINAL_CHORUS: "ラストサビ",
  OUTRO: "アウトロ",
  UNKNOWN: "その他",
};

export const CUE_ACTION_JA: Record<string, string> = {
  HOLD: "そのまま",
  MICRO_SHIFT: "少し動く",
  EXPAND: "広がる",
  CONTRACT: "縮む",
  SPLIT: "分かれる",
  MERGE: "集まる",
  CENTER: "中央へ",
  MAJOR_CHANGE: "大きく変える",
};

export const CUE_MAGNITUDE_JA: Record<string, string> = {
  NONE: "変化なし",
  SMALL: "小さい",
  MEDIUM: "ふつう",
  LARGE: "大きい",
  MAX: "最大",
};

export const FORMATION_TYPES = [
  "LINE",
  "DOUBLE_LINE",
  "WIDE_V",
  "V",
  "CENTER_WINGS",
  "PYRAMID",
  "ARC",
  "CLUSTER",
  "GRID",
  "TRIANGLE",
  "DIAMOND",
  "CENTER",
  "SPLIT",
  "ARROW",
  "DIAGONAL",
  "CUSTOM",
] as const;

export const FORMATION_TYPE_JA: Record<string, string> = {
  LINE: "横一列",
  DOUBLE_LINE: "2列",
  V: "V字",
  WIDE_V: "広いV",
  CENTER: "中央寄り",
  ARC: "弧",
  CLUSTER: "固まり",
  SPLIT: "左右に分ける",
  PYRAMID: "ピラミッド",
  GRID: "グリッド",
  TRIANGLE: "三角",
  DIAMOND: "ダイヤ",
  CENTER_WINGS: "中央＋両翼",
  ARROW: "矢印",
  DIAGONAL: "斜め",
  CUSTOM: "自由配置",
};

export function annotatorShort(annotatorId: string): string {
  const tail = annotatorId.split("-").pop() ?? "a";
  return tail.slice(0, 1);
}

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  const whole = Math.floor(s);
  const frac = Math.round((s - whole) * 10);
  if (frac <= 0) return `${m}:${String(whole).padStart(2, "0")}`;
  return `${m}:${String(whole).padStart(2, "0")}.${frac}`;
}

export function parseClock(raw: string): number {
  const text = raw.trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(":");
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return 0;
}

export function draftKey(annotatorId: string, songId: string): string {
  return `choreocore-blind:${annotatorId}:${songId}`;
}

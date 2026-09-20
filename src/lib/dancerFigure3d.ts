/**
 * 3D 表示用の立ち位置フィギュア種類。
 * プロジェクト JSON には id だけ保存する。
 */

export const DANCER_FIGURE_3D_IDS = [
  "human",
  "dog",
  "cat",
  "rabbit",
  "bird",
  "kirin",
  "elephant",
  "lion",
  "tiger",
  "penguin",
  "bear",
] as const;

export type DancerFigure3dId = (typeof DANCER_FIGURE_3D_IDS)[number];

export type DancerFigure3dMeta = {
  id: DancerFigure3dId;
  /** 日本語ラベル（編集 UI） */
  labelJa: string;
  /** 絵文字（ピッカー用） */
  emoji: string;
};

export const DANCER_FIGURE_3D_CATALOG: readonly DancerFigure3dMeta[] = [
  { id: "human", labelJa: "人型", emoji: "🧍" },
  { id: "dog", labelJa: "犬", emoji: "🐶" },
  { id: "cat", labelJa: "猫", emoji: "🐱" },
  { id: "rabbit", labelJa: "兔", emoji: "🐰" },
  { id: "bird", labelJa: "鳥", emoji: "🐦" },
  { id: "kirin", labelJa: "麒麟", emoji: "🦒" },
  { id: "elephant", labelJa: "象", emoji: "🐘" },
  { id: "lion", labelJa: "ライオン", emoji: "🦁" },
  { id: "tiger", labelJa: "とら", emoji: "🐯" },
  { id: "penguin", labelJa: "ペンギン", emoji: "🐧" },
  { id: "bear", labelJa: "くま", emoji: "🐻" },
];

/** 旧カタログ ID → 現行 ID */
const LEGACY_FIGURE_MAP: Record<string, DancerFigure3dId> = {
  monkey: "bear",
  pig: "bear",
};

const FIGURE_ID_SET = new Set<string>(DANCER_FIGURE_3D_IDS);

export function isDancerFigure3dId(raw: unknown): raw is DancerFigure3dId {
  return typeof raw === "string" && FIGURE_ID_SET.has(raw);
}

/** 不正値は undefined（フィールド省略＝人型）。旧 ID は現行へマップ。 */
export function normalizeDancerFigure3d(
  raw: unknown
): DancerFigure3dId | undefined {
  if (typeof raw !== "string") return undefined;
  if (isDancerFigure3dId(raw)) return raw;
  return LEGACY_FIGURE_MAP[raw];
}

export function resolveDancerFigure3dId(
  raw: unknown
): DancerFigure3dId {
  return normalizeDancerFigure3d(raw) ?? "human";
}

export function dancerFigure3dMeta(
  id: DancerFigure3dId
): DancerFigure3dMeta {
  return (
    DANCER_FIGURE_3D_CATALOG.find((x) => x.id === id) ??
    DANCER_FIGURE_3D_CATALOG[0]!
  );
}

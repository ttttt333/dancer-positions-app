/**
 * 立ち位置○内の LINE スタンプ風フェイス。
 * プロジェクト JSON には id だけ保存する。
 */
export const DANCER_FACE_STAMP_IDS = [
  "smile",
  "laugh",
  "cry",
  "moved",
  "surprise",
  "love",
  "angry",
  "sweat",
  "wink",
  "cool",
  "sparkle",
  "sleepy",
] as const;

export type DancerFaceStampId = (typeof DANCER_FACE_STAMP_IDS)[number];

export type DancerFaceStampMeta = {
  id: DancerFaceStampId;
  /** 日本語ラベル（編集 UI） */
  labelJa: string;
  /** 書き出し canvas 用の絵文字フォールバック */
  emoji: string;
};

export const DANCER_FACE_STAMP_CATALOG: readonly DancerFaceStampMeta[] = [
  { id: "smile", labelJa: "ニコニコ", emoji: "😊" },
  { id: "laugh", labelJa: "楽しい", emoji: "😆" },
  { id: "cry", labelJa: "泣き", emoji: "😢" },
  { id: "moved", labelJa: "感動", emoji: "🥹" },
  { id: "surprise", labelJa: "驚き", emoji: "😲" },
  { id: "love", labelJa: "ハート", emoji: "😍" },
  { id: "angry", labelJa: "むっ", emoji: "😠" },
  { id: "sweat", labelJa: "あせり", emoji: "😅" },
  { id: "wink", labelJa: "ウインク", emoji: "😉" },
  { id: "cool", labelJa: "クール", emoji: "😎" },
  { id: "sparkle", labelJa: "キラキラ", emoji: "🤩" },
  { id: "sleepy", labelJa: "眠い", emoji: "😴" },
];

const STAMP_ID_SET = new Set<string>(DANCER_FACE_STAMP_IDS);

export function isDancerFaceStampId(raw: unknown): raw is DancerFaceStampId {
  return typeof raw === "string" && STAMP_ID_SET.has(raw);
}

/** 不正値は undefined（フィールド省略） */
export function normalizeDancerFaceStamp(
  raw: unknown
): DancerFaceStampId | undefined {
  return isDancerFaceStampId(raw) ? raw : undefined;
}

export function dancerFaceStampMeta(
  id: DancerFaceStampId
): DancerFaceStampMeta {
  return (
    DANCER_FACE_STAMP_CATALOG.find((x) => x.id === id) ??
    DANCER_FACE_STAMP_CATALOG[0]!
  );
}

/** 立ち位置図解析 API の 1 人分 */
export type ParsedPosition = {
  name: string;
  x: number;
  y: number;
  /** AI が推測で補完した可能性（low = 要確認） */
  confidence?: "high" | "low";
};

/** 手書きメモの行（右端数字 = count） */
export type ParsedLine = {
  count: number;
  names: string[];
};

export type ParsePositionResponse = {
  positions: ParsedPosition[];
  /** 行ごとの名寄せ結果（手書きメモ向け） */
  lines?: ParsedLine[];
  /** 各行の names 数と count が一致しない */
  countMismatch?: boolean;
};

/** 立ち位置図解析 API の 1 人分 */
export type ParsedPosition = {
  name: string;
  x: number;
  y: number;
  /** AI が推測で補完した可能性（low = 要確認） */
  confidence?: "high" | "low";
  /** 名簿への名寄せが成功したか */
  rosterMatched?: boolean;
  /** 列ベース解析時の行インデックス（0始まり） */
  lineIndex?: number;
  /** 人マーカー（○）中心。未指定なら x/y がマーカー */
  markerX?: number;
  markerY?: number;
  /** 名前テキストの中心（位置には使わない） */
  labelX?: number;
  labelY?: number;
};

export type ParseImportWarning = {
  kind: string;
  message: string;
};

/** 手書きメモの 1 列 */
export type ParsedLine = {
  /** 画像右端などに書かれた列の人数 */
  count: number;
  names: string[];
  rowIndex?: number;
};

export type CountMismatch = {
  lineIndex: number;
  expected: number;
  actual: number;
};

export type ParsePositionResponse = {
  positions: ParsedPosition[];
  lines?: ParsedLine[];
  countMismatches?: CountMismatch[];
  rawPositions?: ParsedPosition[];
  suggestedPositions?: ParsedPosition[];
  importWarnings?: ParseImportWarning[];
  placement?: "raw" | "suggested";
  imageFrontDirection?: "top" | "bottom" | "left" | "right";
};

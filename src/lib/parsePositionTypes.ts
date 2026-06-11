/** 立ち位置図解析 API の 1 人分 */
export type ParsedPosition = {
  name: string;
  x: number;
  y: number;
  /** AI が推測で補完した可能性（low = 要確認） */
  confidence?: "high" | "low";
};

export type ParsePositionResponse = {
  positions: ParsedPosition[];
};

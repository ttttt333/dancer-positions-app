/** 立ち位置図解析 API の 1 人分 */
export type ParsedPosition = {
  name: string;
  x: number;
  y: number;
};

export type ParsePositionResponse = {
  positions: ParsedPosition[];
};

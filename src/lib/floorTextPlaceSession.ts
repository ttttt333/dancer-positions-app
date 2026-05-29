import type { FloorTextPlaceSession } from "../types/choreography";

/** 床テキスト配置セッションの初期値 */
export function createDefaultFloorTextPlaceSession(
  overrides?: Partial<FloorTextPlaceSession>
): FloorTextPlaceSession {
  return {
    body: "",
    fontSizePx: 24,
    fontWeight: 700,
    xPct: 50,
    yPct: 50,
    color: "#fef08a",
    scope: "formation",
    ...overrides,
  };
}

export const FLOOR_TEXT_BODY_MAX_LEN = 400;

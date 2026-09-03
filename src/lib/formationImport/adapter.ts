import type { ParsedPosition, ParsePositionResponse } from "../parsePositionTypes";
import { reconstructFormation } from "./reconstruct";
import type {
  FormationImportResult,
  PersonDetection,
  ReconstructFormationOptions,
} from "./types";

/**
 * 現行 Vision JSON を「人マーカー」として読む。
 * 手書きで lines から合成された均等グリッド座標は、マーカーではない。
 */
export function detectionsFromParseResponse(
  raw: ParsePositionResponse
): PersonDetection[] {
  return (raw.positions ?? []).map((p, i) => {
    const mx = Number.isFinite(p.markerX) ? p.markerX! : Number(p.x);
    const my = Number.isFinite(p.markerY) ? p.markerY! : Number(p.y);
    return {
      id: `imp-${i}`,
      recognizedName: String(p.name ?? "").trim() || `メンバー${i + 1}`,
      marker: { x: mx || 0, y: my || 0 },
      label:
        Number.isFinite(p.labelX) && Number.isFinite(p.labelY)
          ? { x: p.labelX!, y: p.labelY! }
          : undefined,
    };
  });
}

export function reconstructFromParseResponse(
  raw: ParsePositionResponse,
  opts: ReconstructFormationOptions = {}
): FormationImportResult {
  return reconstructFormation(detectionsFromParseResponse(raw), opts);
}

/** 既存キュー適用が読める形へ。エンジン経路でも dancer id はここでは作らない */
export function importedDancersToParsedPositions(
  result: FormationImportResult
): ParsedPosition[] {
  return result.dancers.map((d) => ({
    name: d.recognizedName,
    x: d.stagePosition.x,
    y: d.stagePosition.y,
    confidence: d.confidence >= 0.9 ? "high" : "low",
    rosterMatched: d.confidence >= 0.9,
    lineIndex: d.structuralRole?.row,
  }));
}

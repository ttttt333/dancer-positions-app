import { matchNamesToRosterUnique } from "../matchNameToRoster";
import {
  detectionsToCanonical,
  formationBoundingBox,
  normalizeInBox,
} from "./geometry";
import { buildFormationGraph } from "./graph";
import { rawStageFromImage, suggestedStageFromRows } from "./mapping";
import {
  assignColumns,
  detectRows,
  inferPattern,
  pairwiseDistanceError,
} from "./rowColumn";
import type {
  FormationImportResult,
  FormationQuality,
  ImportedDancer,
  PersonDetection,
  ReconstructFormationOptions,
} from "./types";
import { scoreConfidence, validateFormationImport } from "./validation";

/**
 * Vision が返した「人マーカー」からフォーメーション構造を復元する。
 * 名前の文字領域ではなく marker を位置の本体にする。
 */
export function reconstructFormation(
  detections: PersonDetection[],
  opts: ReconstructFormationOptions = {}
): FormationImportResult {
  const direction = opts.imageFrontDirection ?? "bottom";
  const orientationConfidence = opts.orientationConfidence ?? 0.7;
  const placement = opts.placement ?? "suggested";
  const imageWidth = opts.imageWidth ?? inferExtent(detections, "x");
  const imageHeight = opts.imageHeight ?? inferExtent(detections, "y");

  const canonical = detectionsToCanonical(
    detections,
    direction,
    imageWidth,
    imageHeight
  );
  const roster = opts.roster ?? [];
  const snapped = matchNamesToRosterUnique(
    canonical.map((d) => d.recognizedName),
    roster
  );

  const named = canonical.map((d, i) => ({
    ...d,
    recognizedName: snapped[i] != null ? snapped[i].name : d.recognizedName,
    matched: snapped[i]?.matched ?? false,
  }));

  const box = formationBoundingBox(named.map((d) => d.marker));
  const rows = detectRows(named, opts.rowCounts);
  const columns = assignColumns(rows);
  const rowLengths = rows.map((r) => r.members.length);
  const pattern = inferPattern(rowLengths);

  const suggested = suggestedStageFromRows(
    named.map((d) => ({
      id: d.id,
      marker: d.marker,
      row: columns.get(d.id)?.row ?? 0,
    })),
    box,
    rows.length
  );

  const dancers: ImportedDancer[] = named.map((d) => {
    const norm = normalizeInBox(d.marker, box);
    const rawStage = rawStageFromImage(d.marker, box);
    const suggestedStage = suggested.get(d.id) ?? rawStage;
    const role = columns.get(d.id);
    return {
      id: d.id,
      recognizedName: d.recognizedName,
      matchedMemberId: null,
      confidence: d.matched ? 0.96 : roster.length ? 0.55 : 0.8,
      imagePosition: { ...d.marker },
      normalizedPosition: {
        x: round4(norm.x),
        y: round4(norm.y),
      },
      stagePosition: placement === "suggested" ? suggestedStage : rawStage,
      rawStagePosition: rawStage,
      suggestedStagePosition: suggestedStage,
      detection: {
        centerX: d.marker.x,
        centerY: d.marker.y,
        radius: d.radius,
      },
      structuralRole: role,
    };
  });

  const relationships = buildFormationGraph(
    named.map((d) => ({ id: d.id, x: d.marker.x, y: d.marker.y }))
  );

  const expectedCount =
    opts.rosterCount ?? (roster.length > 0 ? roster.length : undefined);
  const warnings = validateFormationImport(dancers, expectedCount);

  const distanceError = pairwiseDistanceError(
    named.map((d) => d.marker),
    dancers.map((d) => d.rawStagePosition)
  );

  const confidence = scoreConfidence({
    nameMatched: snapped.filter((s) => s.matched).length,
    total: dancers.length,
    rowCount: rows.length,
    orientationConfidence,
    distanceError,
    warnings,
  });

  const quality: FormationQuality = {
    identity: round2(confidence.nameRecognition * 100),
    position: round2(confidence.positionRecognition * 100),
    distance: round2(clamp01(1 - distanceError) * 100),
    row: round2(confidence.formationRecognition * 100),
    orientation: round2(confidence.orientationRecognition * 100),
    overall: round2(confidence.overall * 100),
  };

  return {
    image: {
      width: imageWidth,
      height: imageHeight,
      corrected: false,
    },
    orientation: {
      imageFrontDirection: direction,
      confidence: orientationConfidence,
    },
    dancers,
    formation: {
      rows: rows.map((r) => ({
        row: r.row,
        dancerIds: r.members.map((m) => m.id),
      })),
      pattern,
      relationships,
    },
    mapping: {
      formationBox: box,
      imageFrontDirection: direction,
      placement,
    },
    confidence,
    quality,
    warnings,
  };
}

function inferExtent(
  detections: PersonDetection[],
  axis: "x" | "y"
): number {
  if (detections.length === 0) return 1;
  return Math.max(...detections.map((d) => d.marker[axis]), 1) * 1.25;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

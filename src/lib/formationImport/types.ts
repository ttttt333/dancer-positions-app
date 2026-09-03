/** 画像のどの辺が客席（手前）か。未指定時は bottom（画像上＝舞台奥） */
export type ImageFrontDirection = "top" | "bottom" | "left" | "right";

export type FormationPattern =
  | "LINE"
  | "V"
  | "INVERTED_V"
  | "TRIANGLE"
  | "PYRAMID"
  | "DIAMOND"
  | "ARC"
  | "GRID"
  | "STAGGERED"
  | "FREE_FORM";

export type PlacementMode = "raw" | "suggested";

export type PersonDetection = {
  id: string;
  recognizedName: string;
  /** 人マーカー（○）の中心。ラベル文字の中心ではない */
  marker: { x: number; y: number };
  label?: { x: number; y: number };
  radius?: number;
};

export type ImportedDancer = {
  id: string;
  recognizedName: string;
  matchedMemberId: string | null;
  confidence: number;
  imagePosition: { x: number; y: number };
  normalizedPosition: { x: number; y: number };
  /** placement に応じた最終ステージ座標（%） */
  stagePosition: { x: number; y: number };
  rawStagePosition: { x: number; y: number };
  suggestedStagePosition: { x: number; y: number };
  detection: {
    centerX: number;
    centerY: number;
    radius?: number;
  };
  structuralRole?: {
    row: number;
    column?: number;
  };
};

export type FormationRelationship = {
  dancerA: string;
  dancerB: string;
  horizontalRelation: "left" | "right" | "same";
  verticalRelation: "front" | "back" | "same";
  distance: number;
  confidence: number;
};

export type FormationStructure = {
  rows: { row: number; dancerIds: string[] }[];
  pattern: FormationPattern;
  relationships: FormationRelationship[];
};

export type StageMapping = {
  /** 検出マーカーだけの矩形。画像全体ではない */
  formationBox: { minX: number; minY: number; maxX: number; maxY: number };
  imageFrontDirection: ImageFrontDirection;
  placement: PlacementMode;
};

export type FormationImportWarning = {
  kind: "count_short" | "count_extra" | "duplicate_name" | "outlier" | "orientation";
  message: string;
  dancerIds?: string[];
};

export type FormationImportConfidence = {
  overall: number;
  nameRecognition: number;
  positionRecognition: number;
  formationRecognition: number;
  orientationRecognition: number;
};

export type FormationQuality = {
  identity: number;
  position: number;
  distance: number;
  row: number;
  orientation: number;
  overall: number;
};

export type FormationImportResult = {
  image: {
    width: number;
    height: number;
    corrected: boolean;
  };
  orientation: {
    imageFrontDirection: ImageFrontDirection;
    confidence: number;
  };
  dancers: ImportedDancer[];
  formation: FormationStructure;
  mapping: StageMapping;
  confidence: FormationImportConfidence;
  quality: FormationQuality;
  warnings: FormationImportWarning[];
};

export type ReconstructFormationOptions = {
  roster?: string[];
  rosterCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  imageFrontDirection?: ImageFrontDirection;
  orientationConfidence?: number;
  placement?: PlacementMode;
  /** 画像右端などに書かれた列人数。上（奥）から。合計が人数と一致するとき行分けに使う */
  rowCounts?: number[];
};

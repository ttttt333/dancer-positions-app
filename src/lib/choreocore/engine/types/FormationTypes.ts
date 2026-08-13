import type { FormationCueAction } from "./CueTypes";

export type FormationType =
  | "CENTER"
  | "LINE"
  | "DOUBLE_LINE"
  | "V"
  | "WIDE_V"
  | "DIAGONAL"
  | "DOUBLE_DIAGONAL"
  | "TRIANGLE"
  | "DIAMOND"
  | "GRID"
  | "ARC"
  | "CLUSTER"
  | "CENTER_WINGS"
  | "SPLIT"
  | "PYRAMID"
  | "ARROW"
  | "CUSTOM";

export type Point = {
  x: number;
  y: number;
};

export type FormationSlotRole = "CENTER" | "MAIN" | "WING" | "GROUP" | "DEFAULT";

export type FormationSlot = {
  x: number;
  y: number;
  visualWeight: number;
  role: FormationSlotRole;
  groupId: number;
};

export type Formation = {
  id: string;
  type: FormationType;
  positions: Record<string, Point>;
  symmetry: number;
  complexity: number;
  stageCoverage: number;
  visualImpact: number;
  tags: string[];
  visualHierarchy?: Record<string, number>;
};

export type FormationCandidate = {
  id: string;
  formation: Formation;
  templateId: string;
  intentMatch: number;
  dancerCountFit: number;
  stageFit: number;
  spacingPreview: number;
  symmetry: number;
  complexity: number;
  stageCoverage: number;
  visualImpact: number;
  rejected: boolean;
  rejectionReasons: string[];
  metadata: {
    generatedFromCueId: string;
    generationStrategy: string;
    groupCount?: number;
    preliminaryScore?: number;
    signature?: string;
  };
};

export type FormationGenerateOptions = {
  variant?: string;
  spread: number;
  groupSizes?: number[];
};

export type FormationTemplate = {
  id: string;
  type: FormationType;
  minCount: number;
  maxCount: number;
  preferredIntents: FormationCueAction[];
  tags: string[];
  complexity: number;
  generator: (dancerCount: number, options: FormationGenerateOptions) => FormationSlot[];
};

export type FormationCandidateConfig = {
  minCandidates: number;
  maxCandidates: number;
};

export const FORMATION_CANDIDATE_VERSION = "3.0.0-phase4";

export class FormationGenerationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FormationGenerationError";
    this.code = code;
  }
}

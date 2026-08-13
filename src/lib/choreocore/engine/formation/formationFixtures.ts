import type {
  FormationCue,
  FormationCueAction,
  FormationChangeMagnitude,
  FormationCueIntent,
  FormationRequest,
  StageConfig,
} from "../types/CueTypes";

export const DEFAULT_STAGE: StageConfig = {
  width: 1000,
  depth: 600,
  safeMargin: 80,
  minDancerDistance: 32,
};

export function makeCue(
  action: FormationCueAction,
  magnitude: FormationChangeMagnitude = "LARGE",
  extra: Partial<FormationCue> = {}
): FormationCue {
  return {
    id: extra.id ?? `cue-${action}-${magnitude}`,
    rawTime: extra.rawTime ?? 48,
    beatTime: extra.beatTime ?? 48,
    barTime: extra.barTime ?? 48,
    action,
    magnitude,
    priority: extra.priority ?? 80,
    confidence: extra.confidence ?? 0.9,
    reasonCodes: extra.reasonCodes ?? [action],
    sourceEventClusterId: extra.sourceEventClusterId ?? "ec-1",
    sourceChangePointIds: extra.sourceChangePointIds ?? ["cp-1"],
    energyBefore: extra.energyBefore ?? 40,
    energyAfter: extra.energyAfter ?? 70,
    deltaEnergy: extra.deltaEnergy ?? 30,
    isMajor: extra.isMajor ?? action === "MAJOR_CHANGE",
    isLocked: extra.isLocked ?? false,
    suppressed: extra.suppressed ?? false,
  };
}

export function makeIntent(
  primary: FormationCueAction,
  secondary: FormationCueAction[] = [],
  prohibited: FormationCueAction[] = []
): FormationCueIntent {
  return { primary, secondary, prohibited };
}

export function makeRequest(
  dancerCount: number,
  action: FormationCueAction = "EXPAND",
  extra: Partial<FormationRequest> = {}
): FormationRequest {
  const magnitude = extra.cue?.magnitude ?? (action === "MICRO_SHIFT" ? "SMALL" : "LARGE");
  const cue = extra.cue ?? makeCue(action, magnitude);
  return {
    dancerCount,
    cue,
    intent: extra.intent ?? makeIntent(action),
    stage: extra.stage ?? DEFAULT_STAGE,
    style: extra.style ?? "SHOW",
    currentFormation: extra.currentFormation,
  };
}

export function lineFormation(
  count: number,
  stage: StageConfig = DEFAULT_STAGE
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const usable = stage.width - stage.safeMargin * 2;
  const y = stage.depth / 2;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    positions[`d${i}`] = {
      x: stage.safeMargin + t * usable,
      y,
    };
  }
  return positions;
}

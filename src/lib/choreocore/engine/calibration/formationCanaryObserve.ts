/**
 * Stage 9 Human Feedback を Canary 観測に載せるだけ。新しい評価 UI は作らない。
 */

import type { CaptureSuggestionInput, HumanFeedbackEvent } from "./humanFeedbackTypes";
import { appendCanaryObservation, getProductionCanaryActivation } from "./formationCanary";
import type { FormationCanaryActivation, FormationCanaryObservation } from "./formationCanaryTypes";
import { candidateContextHash } from "./formationCanaryContext";

function outcomeFromAction(action: string): string {
  if (action === "ACCEPT") return "ACCEPT_UNCHANGED";
  if (action === "REJECT") return "REJECT";
  if (action === "EDIT" || action.endsWith("_EDIT") || action === "SWAP") return "ACCEPT_EDIT";
  return action;
}

export function observationsFromFeedback(input: {
  activation: FormationCanaryActivation;
  projectKey: string;
  songKey?: string;
  sessionKey?: string;
  arm: "V1" | "V2";
  events: HumanFeedbackEvent[];
  observedAt: string;
}): FormationCanaryObservation[] {
  const songKey = input.songKey ?? "unknown-song";
  const sessionKey = input.sessionKey ?? `${input.projectKey}|${songKey}`;
  const hash = candidateContextHash({
    projectKey: input.projectKey,
    songKey,
    sessionKey,
    releasePackageId: input.activation.releasePackageId,
    candidateIds: input.events.map((event) => event.candidateId),
  });
  return input.events
    .filter((event) => event.layer === "formation")
    .map((event) => ({
      activationId: input.activation.activationId,
      releasePackageId: input.activation.releasePackageId,
      projectKey: input.projectKey,
      songKey,
      sessionKey,
      arm: input.arm,
      candidateContextHash: hash,
      productionVersion: "V1" as const,
      activeVersion: input.arm,
      candidateId: event.candidateId,
      humanOutcome: outcomeFromAction(event.action),
      editSignal: event.editSignal,
      observedAt: input.observedAt,
      counterfactual: "unknown" as const,
    }));
}

export function recordCanaryObservationsFromSuggestion(
  input: CaptureSuggestionInput,
  acceptedCueIds: ReadonlySet<string>,
  activation?: FormationCanaryActivation | null
): FormationCanaryObservation[] {
  const active = activation === undefined ? getProductionCanaryActivation() : activation;
  if (!active || !active.config.enabled || active.rolledBack) return [];
  const createdAt = input.createdAt ?? active.activatedAt;
  const events: HumanFeedbackEvent[] = input.cues
    .filter((cue) => input.formations.some((form) => form.id === cue.formationId))
    .map((cue) => ({
      evaluationId: `hfe-${cue.formationId}-${acceptedCueIds.has(cue.id) ? "ACCEPT" : "REJECT"}-${createdAt}`,
      candidateId: cue.formationId,
      kind: "EXPLICIT",
      action: acceptedCueIds.has(cue.id) ? "ACCEPT" : "REJECT",
      layer: "formation",
      timestamp: createdAt,
    }));
  const rows = observationsFromFeedback({
    activation: active,
    projectKey: input.musicId ?? "unknown-project",
    songKey: input.musicId ?? "unknown-song",
    arm: "V2",
    events,
    observedAt: createdAt,
  });
  for (const row of rows) appendCanaryObservation(row);
  return rows;
}

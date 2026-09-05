import type { ReleasePackage } from "./releaseTypes";

export function formatReleaseReport(pkg: ReleasePackage): string {
  return [
    "CHOREOCORE RELEASE GATE",
    "──────────────────────────────",
    `Package: ${pkg.packageId}`,
    `Status: ${pkg.status}`,
    `Applied: ${pkg.applied}`,
    `Auto released: ${pkg.autoReleased}`,
    `Gate: ${pkg.releaseGateVersion}`,
    "",
    "Scope",
    `Formation: ${pkg.scope.formation} (${pkg.formationWeightsVersion})`,
    `Transition: ${pkg.scope.transition} (${pkg.transitionWeightsVersion})`,
    `Music: ${pkg.scope.music}`,
    `Cue: ${pkg.scope.cue}`,
    `Intent: ${pkg.scope.intent}`,
    "",
    "Evidence",
    `Shadow: ${pkg.rationale.shadowResult}`,
    ...pkg.rationale.evidence.map((line) => `- ${line}`),
    "",
    "Why",
    ...pkg.rationale.why.map((line) => `- ${line}`),
    "",
    "Risk",
    ...pkg.rationale.risk.map((line) => `- ${line}`),
    "",
    `Rollback: ${pkg.rationale.rollback}`,
    "",
    "Reviews",
    ...(pkg.reviews.length === 0
      ? ["- none"]
      : pkg.reviews.map((r) => `- ${r.decision} by ${r.reviewerId}: ${r.reason}`)),
    "",
    "──────────────────────────────",
  ].join("\n");
}

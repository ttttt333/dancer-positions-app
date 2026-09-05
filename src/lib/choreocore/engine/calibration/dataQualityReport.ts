import type { RealWorldDataQualityReport } from "./dataQualityTypes";

function pct(value: number | null): string {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

export function formatRealWorldDataQualityReport(report: RealWorldDataQualityReport): string {
  const v = report.volume;
  return [
    "REAL FEEDBACK",
    "━━━━━━━━━━━━━━━━",
    `DATA_SOURCE = ${report.dataSource}`,
    `status=${report.status}`,
    "",
    `Events              ${v.totalEventCount}`,
    `Unique Projects     ${report.diversity.uniqueProjectCount}`,
    `Unique Songs        ${report.diversity.uniqueSongCount}`,
    `Unique Sessions     ${report.diversity.uniqueSessionCount}`,
    `Unique Users        ${report.diversity.uniqueUserCount}`,
    "",
    `ACCEPT              ${v.acceptCount}`,
    `REJECT              ${v.rejectCount}`,
    `EDIT                ${v.editCount}`,
    `UNCHANGED           ${v.unchangedCount}`,
    "",
    `POSITION_EDIT       ${v.positionEditCount}`,
    `FORMATION_EDIT      ${v.formationEditCount}`,
    `ASSIGNMENT_EDIT     ${v.assignmentEditCount}`,
    `SWAP                ${v.swapCount}`,
    `PATH_EDIT           ${v.pathEditCount}`,
    `TIMING_EDIT         ${v.timingEditCount}`,
    "",
    `known songs         ${report.songIdentity.knownSongCount}`,
    `unknown songs       ${report.songIdentity.unknownSongCount}`,
    `song coverage       ${pct(report.songIdentity.songIdentityCoverage)}`,
    `missing pieceTitle  ${report.completeness.missingPieceTitleCount}`,
    `malformed candidate ${report.completeness.missingCandidateIdCount}`,
    `duplicate events    ${report.duplicates.duplicateEventCount}`,
    `duplicate prints    ${report.duplicates.duplicateFingerprintCount}`,
    `version mismatch    ${report.versions.versionMismatchCount}`,
    "",
    `buffer ${report.buffer.currentEventCount}/${report.buffer.bufferCapacity}`,
    "",
    "Blockers",
    ...(report.blockers.length === 0 ? ["- none"] : report.blockers.map((row) => `• ${row}`)),
    "",
    "Warnings",
    ...(report.warnings.length === 0 ? ["- none"] : report.warnings.map((row) => `• ${row}`)),
    "",
    ...report.notes.map((note) => `- ${note}`),
  ].join("\n");
}

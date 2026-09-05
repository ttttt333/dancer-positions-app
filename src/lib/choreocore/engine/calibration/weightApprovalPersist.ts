import { WEIGHT_APPROVAL_STORAGE_KEY, WEIGHT_APPROVAL_VERSION } from "./weightApprovalConfig";
import type { WeightApprovalPackage } from "./weightApprovalTypes";

export type ApprovalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function saveWeightApprovalPackage(
  pkg: WeightApprovalPackage,
  storage: ApprovalStorage
): void {
  const current = loadWeightApprovalPackages(storage);
  const next = [
    ...current.filter((row) => row.proposalId !== pkg.proposalId),
    pkg,
  ].sort((a, b) => a.proposalId.localeCompare(b.proposalId));
  storage.setItem(
    WEIGHT_APPROVAL_STORAGE_KEY,
    JSON.stringify({ schemaVersion: WEIGHT_APPROVAL_VERSION, packages: next })
  );
}

export function loadWeightApprovalPackages(storage: ApprovalStorage): WeightApprovalPackage[] {
  const raw = storage.getItem(WEIGHT_APPROVAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { packages?: WeightApprovalPackage[] };
    return Array.isArray(parsed.packages)
      ? [...parsed.packages].sort((a, b) => a.proposalId.localeCompare(b.proposalId))
      : [];
  } catch {
    return [];
  }
}

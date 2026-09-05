import { RELEASE_DECISION_STORAGE_KEY, RELEASE_DECISION_VERSION } from "./releaseDecisionConfig";
import type { ReleaseDecisionReviewRecord } from "./releaseDecisionTypes";

export type DecisionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadReleaseDecisionReviews(storage: DecisionStorage): ReleaseDecisionReviewRecord[] {
  const raw = storage.getItem(RELEASE_DECISION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { reviews?: ReleaseDecisionReviewRecord[] };
    return Array.isArray(parsed.reviews)
      ? [...parsed.reviews].sort((a, b) => a.reviewId.localeCompare(b.reviewId))
      : [];
  } catch {
    return [];
  }
}

/** Append-only. Historical decisions are never overwritten. */
export function appendReleaseDecisionReview(
  review: ReleaseDecisionReviewRecord,
  storage: DecisionStorage
): ReleaseDecisionReviewRecord[] {
  const current = loadReleaseDecisionReviews(storage);
  const next = [...current, review].sort((a, b) => a.reviewId.localeCompare(b.reviewId));
  storage.setItem(
    RELEASE_DECISION_STORAGE_KEY,
    JSON.stringify({ schemaVersion: RELEASE_DECISION_VERSION, reviews: next })
  );
  return next;
}

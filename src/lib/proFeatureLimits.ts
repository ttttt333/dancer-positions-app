import {
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
  getEntitlements,
} from "./entitlements";
import type { Me } from "../types/authMe";

export { FREE_MAX_CUES, FREE_MAX_DANCERS };

export function isProUser(me: Me | null | undefined): boolean {
  return getEntitlements(me).isPro;
}

/** 指定人数が無料枠を超えるか（count が 11 以上） */
export function isDancerCountOverFreeLimit(
  me: Me | null | undefined,
  count: number
): boolean {
  if (isProUser(me)) return false;
  return count > FREE_MAX_DANCERS;
}

/**
 * キューをあと1つ追加すると無料枠を超えるか。
 * 現在 20 個ある場合に true（21個目で PRO が必要）。
 */
export function isNextCueOverFreeLimit(
  me: Me | null | undefined,
  currentCueCount: number
): boolean {
  if (isProUser(me)) return false;
  return currentCueCount >= FREE_MAX_CUES;
}

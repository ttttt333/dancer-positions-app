import type { Me } from "../types/authMe";
import { isComplimentaryProEmail } from "./complimentaryProEmails";

export const FREE_VIDEO_EXPORT_LIMIT = 10;
/** 無料プランの最大人数（11人以上は PRO） */
export const FREE_MAX_DANCERS = 10;
/** 無料プランの最大キュー数（21個以上は PRO） */
export const FREE_MAX_CUES = 20;

export interface Entitlements {
  isPro: boolean;
  isTrialing: boolean;
  maxProjects: number | null;
  maxMembersPerProject: number | null;
  maxCuesPerProject: number | null;
  videoExportLimit: number | null;
  studentShare: boolean;
  collaboration: boolean;
  aiImport: boolean;
}

export function getEntitlements(me: Me | null | undefined): Entitlements {
  const status = me?.user?.subscription_status?.trim() ?? null;
  const lifetime = me?.user?.entitlement_lifetime === 1;
  const complimentary = isComplimentaryProEmail(me?.user?.email);
  const isTrialing = status === "trialing";
  const isPro =
    me?.user?.is_pro === true ||
    lifetime ||
    complimentary ||
    status === "active" ||
    isTrialing;

  return {
    isPro,
    isTrialing,
    maxProjects: isPro ? null : 3,
    maxMembersPerProject: isPro ? null : FREE_MAX_DANCERS,
    maxCuesPerProject: isPro ? null : FREE_MAX_CUES,
    videoExportLimit: isPro ? null : FREE_VIDEO_EXPORT_LIMIT,
    studentShare: isPro,
    collaboration: isPro,
    aiImport: isPro,
  };
}

/** FREE ユーザーの残り書き出し回数（PRO は null = 無制限） */
export function remainingVideoExports(
  me: Me | null | undefined
): number | null {
  const ent = getEntitlements(me);
  if (ent.videoExportLimit == null) return null;
  const used = me?.user?.video_export_count ?? 0;
  return Math.max(0, ent.videoExportLimit - used);
}

export function isVideoExportLimitReached(me: Me | null | undefined): boolean {
  const remaining = remainingVideoExports(me);
  return remaining !== null && remaining <= 0;
}

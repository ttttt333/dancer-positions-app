import type { Me } from "../types/authMe";
import { isComplimentaryProEmail } from "./complimentaryProEmails";
import { isReleaseCampaignActive } from "./releaseCampaign";

export const FREE_VIDEO_EXPORT_LIMIT = 10;
/** 無料プランの最大人数（11人以上は PRO）※キャンペーン中は無制限 */
export const FREE_MAX_DANCERS = 10;
/** 無料プランの最大キュー数（21個以上は PRO）※キャンペーン中は無制限 */
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
  /** リリースキャンペーンによる開放 */
  releaseCampaign: boolean;
}

function proEntitlements(
  partial: Pick<Entitlements, "isTrialing" | "releaseCampaign">
): Entitlements {
  return {
    isPro: true,
    isTrialing: partial.isTrialing,
    maxProjects: null,
    maxMembersPerProject: null,
    maxCuesPerProject: null,
    videoExportLimit: null,
    studentShare: true,
    collaboration: true,
    aiImport: true,
    releaseCampaign: partial.releaseCampaign,
  };
}

export function getEntitlements(me: Me | null | undefined): Entitlements {
  const status = me?.user?.subscription_status?.trim() ?? null;
  const lifetime = me?.user?.entitlement_lifetime === 1;
  const complimentary = isComplimentaryProEmail(me?.user?.email);
  const isTrialing = status === "trialing";

  if (isReleaseCampaignActive()) {
    return proEntitlements({ isTrialing, releaseCampaign: true });
  }

  const isPro =
    me?.user?.is_pro === true ||
    lifetime ||
    complimentary ||
    status === "active" ||
    isTrialing;

  if (isPro) {
    return proEntitlements({ isTrialing, releaseCampaign: false });
  }

  return {
    isPro: false,
    isTrialing: false,
    maxProjects: 3,
    maxMembersPerProject: FREE_MAX_DANCERS,
    maxCuesPerProject: FREE_MAX_CUES,
    videoExportLimit: FREE_VIDEO_EXPORT_LIMIT,
    studentShare: false,
    collaboration: false,
    aiImport: false,
    releaseCampaign: false,
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

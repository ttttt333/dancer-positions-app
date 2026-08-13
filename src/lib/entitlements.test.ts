import { describe, expect, it } from "vitest";
import {
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
  FREE_VIDEO_EXPORT_LIMIT,
  getEntitlements,
  isVideoExportLimitReached,
  remainingVideoExports,
} from "./entitlements";
import { isReleaseCampaignActive } from "./releaseCampaign";
import type { Me } from "../types/authMe";

describe("entitlements", () => {
  const baseMe: Me = {
    user: { id: "u1", email: "a@b.c" },
    adminOrganizations: [],
    memberOrganizations: [],
  };

  it("release campaign unlocks PRO for everyone", () => {
    expect(isReleaseCampaignActive()).toBe(true);
    const ent = getEntitlements(baseMe);
    expect(ent.isPro).toBe(true);
    expect(ent.releaseCampaign).toBe(true);
    expect(ent.videoExportLimit).toBeNull();
    expect(ent.maxProjects).toBeNull();
    expect(ent.maxMembersPerProject).toBeNull();
    expect(ent.maxCuesPerProject).toBeNull();
    expect(ent.aiImport).toBe(true);
    expect(ent.studentShare).toBe(true);
  });

  it("exports FREE limit constants for non-campaign use", () => {
    expect(FREE_MAX_DANCERS).toBe(10);
    expect(FREE_MAX_CUES).toBe(20);
    expect(FREE_VIDEO_EXPORT_LIMIT).toBe(10);
  });

  it("trialing flag still surfaces during campaign", () => {
    const ent = getEntitlements({
      ...baseMe,
      user: { ...baseMe.user, subscription_status: "trialing" },
    });
    expect(ent.isPro).toBe(true);
    expect(ent.isTrialing).toBe(true);
  });

  it("remaining exports is unlimited during campaign", () => {
    const me: Me = {
      ...baseMe,
      user: { ...baseMe.user, video_export_count: 99 },
    };
    expect(remainingVideoExports(me)).toBeNull();
    expect(isVideoExportLimitReached(me)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  FREE_VIDEO_EXPORT_LIMIT,
  getEntitlements,
  isVideoExportLimitReached,
  remainingVideoExports,
} from "./entitlements";
import type { Me } from "../types/authMe";

describe("entitlements", () => {
  const baseMe: Me = {
    user: { id: "u1", email: "a@b.c" },
    adminOrganizations: [],
    memberOrganizations: [],
  };

  it("FREE user has export limit", () => {
    const ent = getEntitlements(baseMe);
    expect(ent.isPro).toBe(false);
    expect(ent.videoExportLimit).toBe(FREE_VIDEO_EXPORT_LIMIT);
  });

  it("trialing user is Pro", () => {
    const ent = getEntitlements({
      ...baseMe,
      user: { ...baseMe.user, subscription_status: "trialing" },
    });
    expect(ent.isPro).toBe(true);
    expect(ent.isTrialing).toBe(true);
    expect(ent.videoExportLimit).toBeNull();
  });

  it("is_pro from server grant RPC marks Pro", () => {
    const ent = getEntitlements({
      ...baseMe,
      user: { ...baseMe.user, is_pro: true },
    });
    expect(ent.isPro).toBe(true);
    expect(ent.videoExportLimit).toBeNull();
  });

  it("remaining exports decreases with count", () => {
    const me: Me = {
      ...baseMe,
      user: { ...baseMe.user, video_export_count: 7 },
    };
    expect(remainingVideoExports(me)).toBe(3);
    expect(isVideoExportLimitReached(me)).toBe(false);
  });

  it("limit reached at 10", () => {
    const me: Me = {
      ...baseMe,
      user: { ...baseMe.user, video_export_count: 10 },
    };
    expect(remainingVideoExports(me)).toBe(0);
    expect(isVideoExportLimitReached(me)).toBe(true);
  });
});

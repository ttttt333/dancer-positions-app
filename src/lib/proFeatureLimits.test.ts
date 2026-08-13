import { describe, expect, it } from "vitest";
import {
  isDancerCountOverFreeLimit,
  isNextCueOverFreeLimit,
} from "./proFeatureLimits";
import { isReleaseCampaignActive } from "./releaseCampaign";
import type { Me } from "../types/authMe";

const freeMe: Me = {
  user: { id: "u1", email: "a@b.c" },
  adminOrganizations: [],
  memberOrganizations: [],
};

const proMe: Me = {
  user: { id: "u2", email: "pro@b.c", is_pro: true },
  adminOrganizations: [],
  memberOrganizations: [],
};

describe("proFeatureLimits", () => {
  it("during release campaign, free users are not limited", () => {
    expect(isReleaseCampaignActive()).toBe(true);
    expect(isDancerCountOverFreeLimit(freeMe, 100)).toBe(false);
    expect(isNextCueOverFreeLimit(freeMe, 50)).toBe(false);
    expect(isDancerCountOverFreeLimit(proMe, 100)).toBe(false);
  });
});

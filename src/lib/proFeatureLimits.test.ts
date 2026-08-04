import { describe, expect, it } from "vitest";
import {
  isDancerCountOverFreeLimit,
  isNextCueOverFreeLimit,
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
} from "./proFeatureLimits";
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
  it("requires Pro for 10+ dancers on free", () => {
    expect(isDancerCountOverFreeLimit(freeMe, FREE_MAX_DANCERS)).toBe(false);
    expect(isDancerCountOverFreeLimit(freeMe, FREE_MAX_DANCERS + 1)).toBe(true);
    expect(isDancerCountOverFreeLimit(proMe, 100)).toBe(false);
  });

  it("requires Pro when adding the 20th cue on free", () => {
    expect(isNextCueOverFreeLimit(freeMe, FREE_MAX_CUES - 1)).toBe(false);
    expect(isNextCueOverFreeLimit(freeMe, FREE_MAX_CUES)).toBe(true);
    expect(isNextCueOverFreeLimit(proMe, 50)).toBe(false);
  });
});

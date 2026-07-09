/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  hasStripeCustomerId,
  isProFromBilling,
  isProMe,
} from "./supabaseBilling";
import type { Me } from "../types/authMe";

describe("supabaseBilling", () => {
  it("treats active subscription as Pro", () => {
    expect(
      isProFromBilling({
        stripe_customer_id: "cus_x",
        stripe_subscription_id: "sub_x",
        subscription_status: "active",
        entitlement_lifetime: false,
        video_export_count: 0,
      })
    ).toBe(true);
  });

  it("treats lifetime entitlement as Pro", () => {
    expect(
      isProFromBilling({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: null,
        entitlement_lifetime: true,
        video_export_count: 0,
      })
    ).toBe(true);
  });

  it("treats missing billing as free", () => {
    expect(isProFromBilling(null)).toBe(false);
  });

  it("detects stripe customer id on me", () => {
    const me: Me = {
      user: {
        id: "u1",
        email: "a@b.c",
        stripe_customer_id: "cus_123",
      },
      adminOrganizations: [],
      memberOrganizations: [],
    };
    expect(hasStripeCustomerId(me)).toBe(true);
    expect(isProMe(me)).toBe(false);
  });

  it("isProMe includes trialing", () => {
    const me: Me = {
      user: {
        id: "u1",
        email: "a@b.c",
        subscription_status: "trialing",
      },
      adminOrganizations: [],
      memberOrganizations: [],
    };
    expect(isProMe(me)).toBe(true);
  });
});

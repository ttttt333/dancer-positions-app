/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isProFromBilling } from "./supabaseBilling";

describe("supabaseBilling", () => {
  it("treats active subscription as Pro", () => {
    expect(
      isProFromBilling({
        stripe_customer_id: "cus_x",
        stripe_subscription_id: "sub_x",
        subscription_status: "active",
        entitlement_lifetime: false,
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
      })
    ).toBe(true);
  });

  it("treats missing billing as free", () => {
    expect(isProFromBilling(null)).toBe(false);
  });
});

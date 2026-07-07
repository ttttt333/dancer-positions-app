import { getSupabase } from "./supabaseClient";
import type { Me } from "../types/authMe";

export const FREE_CLOUD_PROJECT_LIMIT = 3;

export type ChoreocoreBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  entitlement_lifetime: boolean;
};

export function isProFromBilling(
  billing: ChoreocoreBillingRow | null | undefined
): boolean {
  if (!billing) return false;
  if (billing.entitlement_lifetime) return true;
  const s = billing.subscription_status?.trim();
  return s === "active" || s === "trialing";
}

export function billingFieldsForMe(
  billing: ChoreocoreBillingRow | null
): Partial<Me["user"]> {
  if (!billing) return {};
  return {
    stripe_customer_id: billing.stripe_customer_id,
    stripe_subscription_id: billing.stripe_subscription_id,
    subscription_status: billing.subscription_status,
    entitlement_lifetime: billing.entitlement_lifetime ? 1 : 0,
  };
}

export async function fetchChoreocoreBillingRow(): Promise<ChoreocoreBillingRow | null> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return null;

  const { data, error } = await sb
    .from("choreocore_user_billing")
    .select(
      "stripe_customer_id, stripe_subscription_id, subscription_status, entitlement_lifetime"
    )
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("choreocore_user_billing")
    ) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    stripe_customer_id:
      data.stripe_customer_id != null ? String(data.stripe_customer_id) : null,
    stripe_subscription_id:
      data.stripe_subscription_id != null
        ? String(data.stripe_subscription_id)
        : null,
    subscription_status:
      data.subscription_status != null ? String(data.subscription_status) : null,
    entitlement_lifetime: Boolean(data.entitlement_lifetime),
  };
}

function invokeBillingFunction<T>(
  name: string,
  body?: Record<string, unknown>
): Promise<T> {
  const sb = getSupabase();
  return sb.functions.invoke(name, { body: body ?? {} }).then(({ data, error }) => {
    if (error) {
      throw new Error(error.message || `${name} の呼び出しに失敗しました`);
    }
    const payload = data as { error?: string; url?: string; ok?: boolean };
    if (payload?.error) {
      throw new Error(payload.error);
    }
    return data as T;
  });
}

export async function supabaseCreateCheckoutSession(): Promise<{ url: string }> {
  const data = await invokeBillingFunction<{ url: string }>(
    "billing-create-checkout"
  );
  if (!data?.url) throw new Error("Checkout URL が取得できませんでした");
  return { url: data.url };
}

export async function supabaseVerifyCheckoutSession(
  sessionId: string
): Promise<{ ok: boolean; status?: string }> {
  return invokeBillingFunction<{ ok: boolean; status?: string }>(
    "billing-verify-session",
    { session_id: sessionId }
  );
}

export async function supabaseOpenCustomerPortal(): Promise<{ url: string }> {
  const data = await invokeBillingFunction<{ url: string }>(
    "billing-customer-portal"
  );
  if (!data?.url) {
    throw new Error("Customer Portal URL が取得できませんでした");
  }
  return { url: data.url };
}

export function hasStripeCustomerId(me: Me | null | undefined): boolean {
  const id = me?.user?.stripe_customer_id;
  return typeof id === "string" && id.trim().length > 0;
}

export function isProMe(me: Me | null | undefined): boolean {
  if (!me?.user) return false;
  if (me.user.entitlement_lifetime === 1) return true;
  const s = me.user.subscription_status?.trim();
  return s === "active" || s === "trialing";
}

export async function assertCanCreateSupabaseProject(
  existingCount: number
): Promise<void> {
  const billing = await fetchChoreocoreBillingRow();
  if (isProFromBilling(billing)) return;
  if (existingCount >= FREE_CLOUD_PROJECT_LIMIT) {
    throw new Error("free_limit");
  }
}

export function isFreeLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("free_limit") || msg.includes("無料プラン");
}

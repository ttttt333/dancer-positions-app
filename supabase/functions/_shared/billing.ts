/** Stripe + Supabase 共通（Edge Functions） */

// @ts-ignore Deno
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
// @ts-ignore Deno
const STRIPE_PRICE_ID =
  Deno.env.get("STRIPE_PRICE_ID_PRO") ??
  Deno.env.get("STRIPE_PRICE_ID") ??
  "";
// @ts-ignore Deno
const STRIPE_PRICE_ID_PRO_ANNUAL =
  Deno.env.get("STRIPE_PRICE_ID_PRO_ANNUAL") ?? "";
// @ts-ignore Deno
const STRIPE_TRIAL_DAYS = Number(Deno.env.get("STRIPE_TRIAL_DAYS") ?? "7");
// @ts-ignore Deno
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
// @ts-ignore Deno
const APP_BASE = (Deno.env.get("APP_BASE") ?? "").replace(/\/+$/, "");
// @ts-ignore Deno
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-ignore Deno
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// @ts-ignore Deno
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function requireStripeConfig(): string | null {
  if (!STRIPE_SECRET_KEY) return "STRIPE_SECRET_KEY not configured";
  return null;
}

export function requireCheckoutConfig(): string | null {
  const base = requireStripeConfig();
  if (base) return base;
  if (!APP_BASE) return "APP_BASE not configured";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  return null;
}

export function requireMonthlyCheckoutConfig(): string | null {
  const base = requireCheckoutConfig();
  if (base) return base;
  if (!STRIPE_PRICE_ID) return "STRIPE_PRICE_ID not configured";
  return null;
}

export function requireAnnualCheckoutConfig(): string | null {
  const base = requireCheckoutConfig();
  if (base) return base;
  if (!STRIPE_PRICE_ID_PRO_ANNUAL) {
    return "STRIPE_PRICE_ID_PRO_ANNUAL not configured";
  }
  return null;
}

export function requireWebhookConfig(): string | null {
  const base = requireStripeConfig();
  if (base) return base;
  if (!STRIPE_WEBHOOK_SECRET) return "STRIPE_WEBHOOK_SECRET not configured";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  return null;
}

export function requireVerifyConfig(): string | null {
  const base = requireStripeConfig();
  if (base) return base;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  return null;
}

export function requirePortalConfig(): string | null {
  const base = requireStripeConfig();
  if (base) return base;
  if (!APP_BASE) return "APP_BASE not configured";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  return null;
}

export async function stripeRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  form?: Record<string, string>
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
  };
  let body: string | undefined;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    body,
  });
  const text = await res.text();
  let data: T & { error?: { message?: string } };
  try {
    data = JSON.parse(text) as T & { error?: { message?: string } };
  } catch {
    throw new Error(`Stripe API error (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe API error (${res.status})`);
  }
  return data;
}

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | { id: string; status?: string } | null;
  payment_status: string | null;
  status: string | null;
  mode: string;
};

type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
};

export async function fetchStripeCustomerIdForUser(
  userId: string
): Promise<string | null> {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin
    .from("choreocore_user_billing")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.stripe_customer_id;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
}): Promise<{ url: string }> {
  const cfg = requireMonthlyCheckoutConfig();
  if (cfg) throw new Error(cfg);

  const existingCustomerId = await fetchStripeCustomerIdForUser(opts.userId);
  const trialDays =
    Number.isFinite(STRIPE_TRIAL_DAYS) && STRIPE_TRIAL_DAYS > 0
      ? Math.floor(STRIPE_TRIAL_DAYS)
      : 7;

  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: `${APP_BASE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE}/billing/canceled`,
    client_reference_id: opts.userId,
    "subscription_data[trial_period_days]": String(trialDays),
    "subscription_data[trial_settings][end_behavior][missing_payment_method]":
      "cancel",
  };

  if (existingCustomerId) {
    params.customer = existingCustomerId;
  } else {
    params.customer_email = opts.email;
  }

  const session = await stripeRequest<StripeCheckoutSession>(
    "/checkout/sessions",
    "POST",
    params
  );
  if (!session.url) throw new Error("Checkout URL が取得できませんでした");
  return { url: session.url };
}

/** 年額一括（PayPay / カード）。mode=payment。サブスク非対応の PayPay 向け。 */
export async function createAnnualCheckoutSession(opts: {
  userId: string;
  email: string;
}): Promise<{ url: string }> {
  const cfg = requireAnnualCheckoutConfig();
  if (cfg) throw new Error(cfg);

  const existingCustomerId = await fetchStripeCustomerIdForUser(opts.userId);
  const params: Record<string, string> = {
    mode: "payment",
    "line_items[0][price]": STRIPE_PRICE_ID_PRO_ANNUAL,
    "line_items[0][quantity]": "1",
    success_url: `${APP_BASE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE}/billing/canceled`,
    client_reference_id: opts.userId,
    locale: "ja",
    // PayPay は subscription 非対応。カードと併記（JPY one-time Price 必須）
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "paypay",
    "metadata[plan]": "annual",
    "metadata[product]": "choreocore_pro",
    "payment_intent_data[metadata][plan]": "annual",
    "payment_intent_data[metadata][user_id]": opts.userId,
  };

  if (existingCustomerId) {
    params.customer = existingCustomerId;
  } else {
    params.customer_email = opts.email;
  }

  const session = await stripeRequest<StripeCheckoutSession>(
    "/checkout/sessions",
    "POST",
    params
  );
  if (!session.url) throw new Error("Checkout URL が取得できませんでした");
  return { url: session.url };
}

export async function retrieveCheckoutSession(
  sessionId: string
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    "GET"
  );
}

export async function retrieveSubscription(
  subId: string
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    `/subscriptions/${encodeURIComponent(subId)}`,
    "GET"
  );
}

type StripePortalSession = { url: string };

export async function createCustomerPortalSession(
  customerId: string
): Promise<{ url: string }> {
  const session = await stripeRequest<StripePortalSession>(
    "/billing_portal/sessions",
    "POST",
    {
      customer: customerId,
      return_url: `${APP_BASE}/`,
    }
  );
  if (!session.url) throw new Error("Customer Portal URL が取得できませんでした");
  return { url: session.url };
}

export type BillingUpsert = {
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  entitlement_lifetime?: boolean;
};

export async function upsertBillingRow(row: BillingUpsert): Promise<void> {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const payload: Record<string, unknown> = {
    user_id: row.user_id,
    updated_at: new Date().toISOString(),
  };
  if (row.stripe_customer_id !== undefined) {
    payload.stripe_customer_id = row.stripe_customer_id;
  }
  if (row.stripe_subscription_id !== undefined) {
    payload.stripe_subscription_id = row.stripe_subscription_id;
  }
  if (row.subscription_status !== undefined) {
    payload.subscription_status = row.subscription_status;
  }
  if (row.entitlement_lifetime !== undefined) {
    payload.entitlement_lifetime = row.entitlement_lifetime;
  }
  const { error } = await admin
    .from("choreocore_user_billing")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function updateBillingBySubscriptionId(
  subscriptionId: string,
  status: string,
  clearSub: boolean
): Promise<void> {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const patch: Record<string, unknown> = {
    subscription_status: status,
    updated_at: new Date().toISOString(),
  };
  if (clearSub) patch.stripe_subscription_id = null;
  const { error } = await admin
    .from("choreocore_user_billing")
    .update(patch)
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw new Error(error.message);
}

export async function upsertBillingFromSubscription(sub: {
  id: string;
  status: string;
  customer: string;
}): Promise<void> {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const customerId = String(sub.customer);

  const { data: row, error: findErr } = await admin
    .from("choreocore_user_billing")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!row?.user_id) {
    console.warn(
      "[billing] upsertBillingFromSubscription: no user for customer",
      customerId
    );
    return;
  }

  await upsertBillingRow({
    user_id: row.user_id,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
  });
}

export async function getUserFromAuthHeader(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.id) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
  };
}

export function subscriptionIdFromSession(
  session: StripeCheckoutSession
): string | null {
  const sub = session.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export function subscriptionStatusFromSession(
  session: StripeCheckoutSession
): string {
  const sub = session.subscription;
  if (sub && typeof sub !== "string" && sub.status) return sub.status;
  return "active";
}

export async function applyCheckoutSessionToUser(
  userId: string,
  session: StripeCheckoutSession
): Promise<string> {
  const customerId = session.customer ? String(session.customer) : null;
  const mode = (session.mode || "subscription").trim();
  const paid = session.payment_status === "paid";

  /** 年額一括（PayPay / カード）→ 1 年 Pro 付与。PayPay は非同期完了があり得る。 */
  if (mode === "payment") {
    if (!paid) {
      // checkout.session.completed 時点では unpaid のことがある → async 待ち
      return "pending_payment";
    }
    await grantPrepaidAnnualFromCheckout(userId, session.id, customerId);
    return "prepaid_annual";
  }

  const subId = subscriptionIdFromSession(session);
  let status = subscriptionStatusFromSession(session);
  /** webhook 到着順は保証されないため、subscription ID があれば Stripe から最新状態を取得 */
  if (subId) {
    try {
      const live = await retrieveSubscription(subId);
      status = live.status;
    } catch (e) {
      console.error(
        "[billing] retrieveSubscription failed; using session status",
        subId,
        e
      );
    }
  }
  await upsertBillingRow({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subId,
    subscription_status: subId ? status : null,
  });
  return status;
}

const PREPAID_ANNUAL_DAYS = 365;

/** Checkout mode=payment 完了時に 1 年 Pro（idempotent by session id） */
export async function grantPrepaidAnnualFromCheckout(
  userId: string,
  checkoutSessionId: string,
  customerId: string | null
): Promise<void> {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing, error: exErr } = await admin
    .from("choreocore_pro_grants")
    .select("id")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (existing?.id) {
    if (customerId) {
      await upsertBillingRow({
        user_id: userId,
        stripe_customer_id: customerId,
      });
    }
    return;
  }

  const now = new Date();
  const { data: activeRows, error: actErr } = await admin
    .from("choreocore_pro_grants")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("grant_type", "prepaid_annual")
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: false })
    .limit(1);
  if (actErr) throw new Error(actErr.message);

  const latest = activeRows?.[0]?.expires_at
    ? new Date(String(activeRows[0].expires_at))
    : null;
  const base =
    latest && Number.isFinite(latest.getTime()) && latest > now ? latest : now;
  const expires = new Date(base.getTime());
  expires.setUTCDate(expires.getUTCDate() + PREPAID_ANNUAL_DAYS);

  const { error: insErr } = await admin.from("choreocore_pro_grants").insert({
    user_id: userId,
    grant_type: "prepaid_annual",
    expires_at: expires.toISOString(),
    note: "Stripe annual prepaid (PayPay/card)",
    stripe_checkout_session_id: checkoutSessionId,
  });
  if (insErr) {
    // 競合（同一 session の二重 webhook）は成功扱い
    if (/duplicate|unique/i.test(insErr.message)) {
      return;
    }
    throw new Error(insErr.message);
  }

  await upsertBillingRow({
    user_id: userId,
    stripe_customer_id: customerId,
  });
}

export { STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY };

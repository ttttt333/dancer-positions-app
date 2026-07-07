/** Stripe + Supabase 共通（Edge Functions） */

// @ts-ignore Deno
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
// @ts-ignore Deno
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
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
  if (!STRIPE_PRICE_ID) return "STRIPE_PRICE_ID not configured";
  if (!APP_BASE) return "APP_BASE not configured";
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

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
}): Promise<{ url: string }> {
  const session = await stripeRequest<StripeCheckoutSession>(
    "/checkout/sessions",
    "POST",
    {
      mode: "subscription",
      "line_items[0][price]": STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      success_url: `${APP_BASE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_BASE}/billing/canceled`,
      client_reference_id: opts.userId,
      customer_email: opts.email,
    }
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

export { STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY };

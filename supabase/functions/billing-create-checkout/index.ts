/**
 * billing-create-checkout — Stripe Checkout Session を作成
 * body: { plan?: "monthly" | "annual" }  （省略時 monthly）
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  createAnnualCheckoutSession,
  createCheckoutSession,
  getUserFromAuthHeader,
  jsonResponse,
  requireAnnualCheckoutConfig,
  requireCheckoutConfig,
  requireMonthlyCheckoutConfig,
} from "../_shared/billing.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const baseErr = requireCheckoutConfig();
  if (baseErr) {
    return jsonResponse({ error: baseErr }, 503);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }

  let plan: "monthly" | "annual" = "monthly";
  try {
    const body = (await req.json()) as { plan?: string };
    if (body?.plan === "annual") plan = "annual";
  } catch {
    /* empty body → monthly */
  }

  try {
    if (plan === "annual") {
      const annualErr = requireAnnualCheckoutConfig();
      if (annualErr) return jsonResponse({ error: annualErr }, 503);
      const { url } = await createAnnualCheckoutSession({
        userId: user.id,
        email: user.email,
      });
      return jsonResponse({ url, plan: "annual" });
    }

    const monthlyErr = requireMonthlyCheckoutConfig();
    if (monthlyErr) return jsonResponse({ error: monthlyErr }, 503);
    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
    });
    return jsonResponse({ url, plan: "monthly" });
  } catch (e) {
    console.error("[billing-create-checkout]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Checkout 作成に失敗しました" },
      500
    );
  }
});

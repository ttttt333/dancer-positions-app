/**
 * billing-create-checkout — Stripe Checkout Session を作成
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  createCheckoutSession,
  getUserFromAuthHeader,
  jsonResponse,
  requireCheckoutConfig,
} from "../_shared/billing.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requireCheckoutConfig();
  if (configErr) {
    return jsonResponse({ error: configErr }, 503);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }

  try {
    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
    });
    return jsonResponse({ url });
  } catch (e) {
    console.error("[billing-create-checkout]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Checkout 作成に失敗しました" },
      500
    );
  }
});

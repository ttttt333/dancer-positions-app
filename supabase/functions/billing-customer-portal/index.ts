/**
 * billing-customer-portal — Stripe Customer Portal（解約・カード変更・請求履歴）
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  createCustomerPortalSession,
  fetchStripeCustomerIdForUser,
  getUserFromAuthHeader,
  jsonResponse,
  requirePortalConfig,
} from "../_shared/billing.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requirePortalConfig();
  if (configErr) {
    return jsonResponse({ error: configErr }, 503);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }

  try {
    const customerId = await fetchStripeCustomerIdForUser(user.id);
    if (!customerId) {
      return jsonResponse(
        { error: "お支払い情報がまだ登録されていません" },
        404
      );
    }
    const { url } = await createCustomerPortalSession(customerId);
    return jsonResponse({ url });
  } catch (e) {
    console.error("[billing-customer-portal]", e);
    return jsonResponse(
      {
        error:
          e instanceof Error ? e.message : "Customer Portal の作成に失敗しました",
      },
      500
    );
  }
});

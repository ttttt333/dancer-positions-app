/**
 * billing-verify-session — Checkout 完了後に課金状態を DB へ反映
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyCheckoutSessionToUser,
  CORS_HEADERS,
  getUserFromAuthHeader,
  jsonResponse,
  requireVerifyConfig,
  retrieveCheckoutSession,
} from "../_shared/billing.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requireVerifyConfig();
  if (configErr) {
    return jsonResponse({ error: configErr }, 503);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }

  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId) {
    return jsonResponse({ error: "session_id が必要です" }, 400);
  }

  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.client_reference_id !== user.id) {
      return jsonResponse({ error: "不正なセッションです" }, 403);
    }
    const paid =
      session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return jsonResponse(
        {
          error: "支払いが完了していません",
          payment_status: session.payment_status,
        },
        400
      );
    }
    const status = await applyCheckoutSessionToUser(user.id, session);
    return jsonResponse({ ok: true, status });
  } catch (e) {
    console.error("[billing-verify-session]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "検証に失敗しました" },
      500
    );
  }
});

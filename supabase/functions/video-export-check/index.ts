/**
 * video-export-check — 動画書き出し前の上限判定 + カウント増分（FREE: 累計10回）
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  getUserFromAuthHeader,
  jsonResponse,
} from "../_shared/billing.ts";

// @ts-ignore Deno
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-ignore Deno
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function requireServiceConfig(): string | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requireServiceConfig();
  if (configErr) {
    return jsonResponse({ error: configErr }, 503);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }

  try {
    // @ts-ignore Deno
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: canExport, error: canErr } = await admin.rpc(
      "choreocore_can_export_video",
      { p_user_id: user.id }
    );
    if (canErr) {
      console.error("[video-export-check] can_export", canErr);
      return jsonResponse({ error: canErr.message }, 500);
    }

    if (!canExport) {
      return jsonResponse(
        { allowed: false, reason: "export_limit_reached" },
        403
      );
    }

    const { data: newCount, error: incErr } = await admin.rpc(
      "choreocore_increment_export_count",
      { p_user_id: user.id }
    );
    if (incErr) {
      console.error("[video-export-check] increment", incErr);
      return jsonResponse({ error: incErr.message }, 500);
    }

    return jsonResponse({
      allowed: true,
      exportCount: typeof newCount === "number" ? newCount : null,
    });
  } catch (e) {
    console.error("[video-export-check]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "チェックに失敗しました" },
      500
    );
  }
});

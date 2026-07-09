/**
 * admin-grant-pro — 管理者が特定アカウントへ PRO を無料付与 / 取り消し
 *
 * Secrets:
 *   CHOREOCORE_ADMIN_EMAILS … カンマ区切り管理者メール（例: you@example.com,ops@example.com）
 *
 * Body (JSON):
 *   { "action": "grant", "email": "teacher@example.com", "grantType": "complimentary", "expiresAt": null, "note": "ベータ協力" }
 *   { "action": "revoke", "email": "teacher@example.com" }
 *   { "action": "list", "email": "teacher@example.com" }  // email 省略時は直近付与一覧
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  createServiceClient,
  jsonResponse,
  requireAdminConfig,
  requireAdminUser,
  resolveTargetUserId,
  type AdminGrantBody,
  type GrantType,
} from "../_shared/admin.ts";

const VALID_GRANT_TYPES = new Set<GrantType>([
  "complimentary",
  "beta",
  "partner",
  "staff",
]);

function parseExpiresAt(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("expiresAt の形式が不正です（ISO 8601）");
  }
  return d.toISOString();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requireAdminConfig();
  if (configErr) {
    return jsonResponse({ error: configErr }, 503);
  }

  const adminUser = await requireAdminUser(req);
  if (adminUser instanceof Response) return adminUser;

  let body: AdminGrantBody = {};
  try {
    body = (await req.json()) as AdminGrantBody;
  } catch {
    return jsonResponse({ error: "JSON body が必要です" }, 400);
  }

  const action = body.action ?? "grant";

  try {
    const admin = await createServiceClient();

    if (action === "list") {
      const limit = Math.min(100, Math.max(1, Math.floor(body.limit ?? 30)));
      const targetId = await resolveTargetUserId(admin, body);

      let query = admin
        .from("choreocore_pro_grants")
        .select(
          "id, user_id, grant_type, granted_by, granted_at, expires_at, revoked_at, note, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (targetId) {
        query = query.eq("user_id", targetId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, grants: data ?? [] });
    }

    const targetUserId = await resolveTargetUserId(admin, body);
    if (!targetUserId) {
      return jsonResponse(
        { error: "email または userId で対象ユーザーを指定してください" },
        400
      );
    }

    if (action === "grant") {
      const grantType = (body.grantType ?? "complimentary") as GrantType;
      if (!VALID_GRANT_TYPES.has(grantType)) {
        return jsonResponse({ error: "grantType が不正です" }, 400);
      }

      const expiresAt = parseExpiresAt(body.expiresAt ?? null);
      const note =
        typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

      const { data, error } = await admin
        .from("choreocore_pro_grants")
        .insert({
          user_id: targetUserId,
          grant_type: grantType,
          granted_by: adminUser.id,
          expires_at: expiresAt,
          note,
        })
        .select(
          "id, user_id, grant_type, granted_by, granted_at, expires_at, revoked_at, note"
        )
        .single();

      if (error) throw new Error(error.message);

      return jsonResponse({
        ok: true,
        grant: data,
        message: "PRO 無料付与を記録しました。対象ユーザーは再読み込みで反映されます。",
      });
    }

    if (action === "revoke") {
      const grantId =
        typeof body.grantId === "number" && Number.isFinite(body.grantId)
          ? Math.floor(body.grantId)
          : null;

      const now = new Date().toISOString();

      if (grantId != null) {
        const { data, error } = await admin
          .from("choreocore_pro_grants")
          .update({ revoked_at: now })
          .eq("id", grantId)
          .eq("user_id", targetUserId)
          .is("revoked_at", null)
          .select("id, user_id, revoked_at")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) {
          return jsonResponse({ error: "取り消し対象の付与が見つかりません" }, 404);
        }
        return jsonResponse({ ok: true, revoked: data });
      }

      const { data, error } = await admin
        .from("choreocore_pro_grants")
        .update({ revoked_at: now })
        .eq("user_id", targetUserId)
        .is("revoked_at", null)
        .select("id, user_id, revoked_at");

      if (error) throw new Error(error.message);

      return jsonResponse({
        ok: true,
        revokedCount: data?.length ?? 0,
        revoked: data ?? [],
      });
    }

    return jsonResponse({ error: "action は grant / revoke / list です" }, 400);
  } catch (e) {
    console.error("[admin-grant-pro]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "処理に失敗しました" },
      500
    );
  }
});

import { getSupabase, isSupabaseBackend } from "./supabaseClient";

export type VideoExportAllowanceResult =
  | { allowed: true; exportCount: number | null }
  | { allowed: false; reason: "export_limit_reached" | "unauthorized" };

export class VideoExportLimitError extends Error {
  readonly reason = "export_limit_reached" as const;

  constructor() {
    super("export_limit_reached");
    this.name = "VideoExportLimitError";
  }
}

type AllowancePayload = {
  allowed?: boolean;
  reason?: string;
  exportCount?: number | null;
  error?: string;
};

function parseAllowancePayload(
  payload: AllowancePayload | null | undefined
): VideoExportAllowanceResult {
  if (payload?.error) {
    throw new Error(payload.error);
  }

  if (!payload?.allowed) {
    if (payload?.reason === "export_limit_reached") {
      return { allowed: false, reason: "export_limit_reached" };
    }
    return { allowed: false, reason: "unauthorized" };
  }

  return {
    allowed: true,
    exportCount:
      typeof payload.exportCount === "number" ? payload.exportCount : null,
  };
}

function isMissingRpcError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("function") && m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

function isEdgeFunctionUnavailable(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  const status =
    typeof error === "object" && error && "context" in error
      ? (error as { context?: { status?: number } }).context?.status
      : undefined;
  const m = message.toLowerCase();
  return (
    status === 404 ||
    m.includes("failed to send a request to the edge function") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror")
  );
}

async function requestViaAllowanceRpc(
  userId: string
): Promise<VideoExportAllowanceResult | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc(
    "choreocore_request_video_export_allowance"
  );

  if (error) {
    if (isMissingRpcError(error.message)) {
      return null;
    }
    throw new Error(error.message || "動画書き出しの確認に失敗しました");
  }

  return parseAllowancePayload(data as AllowancePayload);
}

async function requestViaEdgeFunction(): Promise<VideoExportAllowanceResult | null> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke("video-export-check", {
    body: {},
  });

  if (error) {
    if (isEdgeFunctionUnavailable(error)) {
      return null;
    }
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 403) {
      return { allowed: false, reason: "export_limit_reached" };
    }
    if (status === 401) {
      return { allowed: false, reason: "unauthorized" };
    }
    throw new Error(error.message || "動画書き出しの確認に失敗しました");
  }

  return parseAllowancePayload(data as AllowancePayload);
}

/** RPC / Edge Function 未配置時: 上限のみ確認（カウント増分なし） */
async function requestViaCanExportOnly(
  userId: string
): Promise<VideoExportAllowanceResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("choreocore_can_export_video", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || "動画書き出しの確認に失敗しました");
  }

  if (!data) {
    return { allowed: false, reason: "export_limit_reached" };
  }

  console.warn(
    "[videoExport] choreocore_request_video_export_allowance / video-export-check unavailable; export allowed without server increment"
  );
  return { allowed: true, exportCount: null };
}

/**
 * 書き出し開始前にサーバー側で上限チェック + カウント増分。
 * Supabase 未使用・未ログイン時はスキップ（共有閲覧の匿名利用を維持）。
 */
export async function requestVideoExportAllowance(): Promise<VideoExportAllowanceResult> {
  if (!isSupabaseBackend()) {
    return { allowed: true, exportCount: null };
  }

  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    return { allowed: true, exportCount: null };
  }

  const userId = userData.user.id;

  const viaRpc = await requestViaAllowanceRpc(userId);
  if (viaRpc) return viaRpc;

  const viaEdge = await requestViaEdgeFunction();
  if (viaEdge) return viaEdge;

  return requestViaCanExportOnly(userId);
}

export async function assertVideoExportAllowed(): Promise<number | null> {
  const result = await requestVideoExportAllowance();
  if (!result.allowed) {
    if (result.reason === "export_limit_reached") {
      throw new VideoExportLimitError();
    }
    throw new Error("ログインが必要です");
  }
  return result.exportCount;
}

import { isSupabaseBackend } from "./supabaseClient";

export type ActiveAudioSourceKind = "server" | "supabase" | "flow" | null;

/** 音源参照の優先度: legacy server asset > Supabase path > flow ローカル */
export function resolveActiveAudioSource(params: {
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
}): ActiveAudioSourceKind {
  if (params.audioAssetId != null && Number.isFinite(params.audioAssetId)) {
    return "server";
  }
  const path =
    typeof params.audioSupabasePath === "string"
      ? params.audioSupabasePath.trim()
      : "";
  if (isSupabaseBackend() && path.length > 0) {
    return "supabase";
  }
  const flowKey = params.flowLocalAudioKey;
  if (typeof flowKey === "string" && flowKey.length > 0) {
    return "flow";
  }
  return null;
}

/** 複数フィールドが同時に入っていた JSON を単一ソースに正規化 */
export function pickExclusiveAudioFields(fields: {
  audioAssetId: number | null;
  audioSupabasePath: string | null;
  flowLocalAudioKey: string | null;
}): {
  audioAssetId: number | null;
  audioSupabasePath: string | null;
  flowLocalAudioKey: string | null;
} {
  if (fields.audioAssetId != null) {
    return {
      audioAssetId: fields.audioAssetId,
      audioSupabasePath: null,
      flowLocalAudioKey: null,
    };
  }
  const path = fields.audioSupabasePath?.trim() ?? "";
  if (path.length > 0) {
    return {
      audioAssetId: null,
      audioSupabasePath: path,
      flowLocalAudioKey: null,
    };
  }
  return {
    audioAssetId: null,
    audioSupabasePath: null,
    flowLocalAudioKey: fields.flowLocalAudioKey,
  };
}

import type { RemoteAudioLoadContext } from "../types";

/** 音源の取得元（Server API / Supabase / Flow ローカル） */
export type AudioProviderId = "server" | "supabase" | "flow";

export type AudioSourceProvider<TParams extends object = object> = {
  readonly id: AudioProviderId;
  load(params: RemoteAudioLoadContext & TParams): Promise<void>;
  reportError(err: unknown, ctx?: { publicShareView?: boolean }): void;
};

import type { RemoteAudioLoadContext } from "./types";
import { flowAudioProvider } from "./providers/flowAudioProvider";
import { serverAudioProvider } from "./providers/serverAudioProvider";
import { supabaseAudioProvider } from "./providers/supabaseAudioProvider";
import type { AudioProviderId } from "./providers/audioProviderTypes";

const providers = {
  server: serverAudioProvider,
  supabase: supabaseAudioProvider,
  flow: flowAudioProvider,
} as const;

/** Provider ID から音源ロードを実行（Hook 層はここ経由で呼ぶ） */
export async function loadAudioFromProvider(
  id: AudioProviderId,
  params: RemoteAudioLoadContext & Record<string, unknown>
): Promise<void> {
  const provider = providers[id];
  await provider.load(params as never);
}

export function reportAudioProviderError(
  id: AudioProviderId,
  err: unknown,
  ctx?: { publicShareView?: boolean }
): void {
  providers[id].reportError(err, ctx);
}

export { serverAudioProvider, supabaseAudioProvider, flowAudioProvider };

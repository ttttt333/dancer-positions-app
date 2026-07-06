import {
  loadSupabaseAudio,
  reportSupabaseAudioLoadError,
  type LoadSupabaseAudioParams,
} from "../loadSupabaseAudio";
import type { AudioSourceProvider } from "./audioProviderTypes";

export type SupabaseAudioProviderParams = Pick<
  LoadSupabaseAudioParams,
  "effectivePath"
>;

export const supabaseAudioProvider: AudioSourceProvider<SupabaseAudioProviderParams> =
  {
    id: "supabase",
    load: (params) => loadSupabaseAudio(params),
    reportError: (err, ctx) =>
      reportSupabaseAudioLoadError(ctx?.publicShareView ?? false, err),
  };

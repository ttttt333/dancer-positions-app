import {
  loadServerAudio,
  reportServerAudioLoadError,
  type LoadServerAudioParams,
} from "../loadServerAudio";
import type { AudioSourceProvider } from "./audioProviderTypes";

export type ServerAudioProviderParams = Pick<LoadServerAudioParams, "assetId">;

export const serverAudioProvider: AudioSourceProvider<ServerAudioProviderParams> =
  {
    id: "server",
    load: (params) => loadServerAudio(params),
    reportError: (err) => reportServerAudioLoadError(err),
  };

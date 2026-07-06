import {
  loadFlowAudio,
  reportFlowAudioLoadError,
  type LoadFlowAudioParams,
} from "../loadFlowAudio";
import type { AudioSourceProvider } from "./audioProviderTypes";

export type FlowAudioProviderParams = Pick<LoadFlowAudioParams, "flowKey">;

export const flowAudioProvider: AudioSourceProvider<FlowAudioProviderParams> = {
  id: "flow",
  load: (params) => loadFlowAudio(params),
  reportError: (err) => reportFlowAudioLoadError(err),
};

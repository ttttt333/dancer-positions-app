import { create } from "zustand";

/** Blob URL は短命。正は Supabase パス / サーバ ID / フローキー */
export type PlaybackAudioSource =
  | { kind: "supabase"; path: string }
  | { kind: "server"; assetId: number }
  | { kind: "flow"; flowKey: string }
  | null;

type PlaybackAudioStore = {
  source: PlaybackAudioSource;
  /** 現在 `<audio>` に載せている短命 blob URL（正ではない） */
  ephemeralBlobUrl: string | null;
  setSupabaseSource: (path: string) => void;
  setServerSource: (assetId: number) => void;
  setFlowSource: (flowKey: string) => void;
  setEphemeralBlobUrl: (url: string | null) => void;
  clearSource: () => void;
};

export const usePlaybackAudioStore = create<PlaybackAudioStore>((set) => ({
  source: null,
  ephemeralBlobUrl: null,
  setSupabaseSource: (path) =>
    set({
      source: { kind: "supabase", path: path.trim() },
      ephemeralBlobUrl: null,
    }),
  setServerSource: (assetId) =>
    set({
      source: { kind: "server", assetId },
      ephemeralBlobUrl: null,
    }),
  setFlowSource: (flowKey) =>
    set({
      source: { kind: "flow", flowKey },
      ephemeralBlobUrl: null,
    }),
  setEphemeralBlobUrl: (url) => set({ ephemeralBlobUrl: url }),
  clearSource: () => set({ source: null, ephemeralBlobUrl: null }),
}));

export function playbackAudioRestoreContextFromStore(): {
  audioSupabasePath: string | null;
  audioAssetId: number | null;
  flowLocalAudioKey: string | null;
} {
  const s = usePlaybackAudioStore.getState().source;
  if (!s) {
    return {
      audioSupabasePath: null,
      audioAssetId: null,
      flowLocalAudioKey: null,
    };
  }
  if (s.kind === "supabase") {
    return {
      audioSupabasePath: s.path,
      audioAssetId: null,
      flowLocalAudioKey: null,
    };
  }
  if (s.kind === "server") {
    return {
      audioSupabasePath: null,
      audioAssetId: s.assetId,
      flowLocalAudioKey: null,
    };
  }
  return {
    audioSupabasePath: null,
    audioAssetId: null,
    flowLocalAudioKey: s.flowKey,
  };
}

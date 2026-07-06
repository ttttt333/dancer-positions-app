import { describe, expect, it, vi } from "vitest";
import {
  pickExclusiveAudioFields,
  resolveActiveAudioSource,
} from "./audioSourcePriority";

vi.mock("./supabaseClient", () => ({
  isSupabaseBackend: () => true,
}));

describe("pickExclusiveAudioFields", () => {
  it("keeps server asset and clears other fields", () => {
    expect(
      pickExclusiveAudioFields({
        audioAssetId: 42,
        audioSupabasePath: "user/foo.mp3",
        flowLocalAudioKey: "flow-key",
      })
    ).toEqual({
      audioAssetId: 42,
      audioSupabasePath: null,
      flowLocalAudioKey: null,
    });
  });

  it("keeps supabase path when no server asset", () => {
    expect(
      pickExclusiveAudioFields({
        audioAssetId: null,
        audioSupabasePath: "  user/foo.mp3  ",
        flowLocalAudioKey: "flow-key",
      })
    ).toEqual({
      audioAssetId: null,
      audioSupabasePath: "user/foo.mp3",
      flowLocalAudioKey: null,
    });
  });

  it("falls through to flow key when no remote refs", () => {
    expect(
      pickExclusiveAudioFields({
        audioAssetId: null,
        audioSupabasePath: null,
        flowLocalAudioKey: "flow-key",
      })
    ).toEqual({
      audioAssetId: null,
      audioSupabasePath: null,
      flowLocalAudioKey: "flow-key",
    });
  });
});

describe("resolveActiveAudioSource", () => {
  it("prefers server over supabase and flow", () => {
    expect(
      resolveActiveAudioSource({
        audioAssetId: 1,
        audioSupabasePath: "a.mp3",
        flowLocalAudioKey: "k",
      })
    ).toBe("server");
  });

  it("uses supabase when configured", () => {
    expect(
      resolveActiveAudioSource({
        audioAssetId: null,
        audioSupabasePath: "a.mp3",
        flowLocalAudioKey: "k",
      })
    ).toBe("supabase");
  });
});

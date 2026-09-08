import { describe, expect, it } from "vitest";
import {
  isServerNewerThanKnown,
  patchProjectAudioCloudFields,
  projectJsonDiffers,
  shouldClearEditorDraftAfterCloudSave,
} from "./projectConflict";

describe("projectConflict", () => {
  it("detects newer server updated_at", () => {
    expect(
      isServerNewerThanKnown(
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(true);
    expect(
      isServerNewerThanKnown(
        "2026-01-01T00:01:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(false);
  });

  it("detects json differences", () => {
    expect(projectJsonDiffers({ a: 1 }, { a: 1 })).toBe(false);
    expect(projectJsonDiffers({ a: 1 }, { a: 2 })).toBe(true);
  });

  it("keeps draft when live project advanced during cloud save", () => {
    expect(shouldClearEditorDraftAfterCloudSave('{"v":1}', '{"v":1}')).toBe(
      true
    );
    expect(shouldClearEditorDraftAfterCloudSave('{"v":1}', '{"v":2}')).toBe(
      false
    );
    expect(shouldClearEditorDraftAfterCloudSave('{"v":1}', null)).toBe(true);
  });

  it("patches only audio cloud fields onto latest project", () => {
    const latest = {
      cues: [{ id: "new" }],
      audioSupabasePath: null as string | null,
      audioAssetId: "old" as string | null,
      flowLocalAudioKey: "local" as string | null,
    };
    const patched = patchProjectAudioCloudFields(latest, "user/a.mp3");
    expect(patched.cues).toEqual([{ id: "new" }]);
    expect(patched.audioSupabasePath).toBe("user/a.mp3");
    expect(patched.audioAssetId).toBeNull();
    expect(patched.flowLocalAudioKey).toBeNull();
  });
});

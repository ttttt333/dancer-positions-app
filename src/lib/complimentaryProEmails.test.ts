import { describe, expect, it } from "vitest";
import { isComplimentaryProEmail } from "./complimentaryProEmails";

describe("complimentaryProEmails", () => {
  it("matches the lifetime Pro email case-insensitively", () => {
    expect(isComplimentaryProEmail("interush.info@gmail.com")).toBe(true);
    expect(isComplimentaryProEmail("Interush.Info@Gmail.com")).toBe(true);
  });

  it("rejects unrelated emails", () => {
    expect(isComplimentaryProEmail("other@example.com")).toBe(false);
    expect(isComplimentaryProEmail("")).toBe(false);
    expect(isComplimentaryProEmail(null)).toBe(false);
  });
});

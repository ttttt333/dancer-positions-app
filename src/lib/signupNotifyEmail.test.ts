import { describe, expect, it } from "vitest";
import {
  buildSignupNotifyEmail,
  infoFromAuthRecord,
  providerLabel,
  sampleSignupNotifyInfo,
} from "./signupNotifyEmail";

describe("signup notify email", () => {
  it("labels providers in Japanese", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("email")).toBe("メール＋パスワード");
  });

  it("builds a sample subject and never includes a password", () => {
    const mail = buildSignupNotifyEmail(sampleSignupNotifyInfo());
    expect(mail.subject).toContain("【サンプル】");
    expect(mail.subject).toContain("sample.user@example.com");
    expect(mail.text).toContain("Google");
    expect(mail.text).toContain("日本");
    expect(mail.subject).toContain("日本");
    expect(mail.text.toLowerCase()).not.toContain("password");
    expect(mail.html.toLowerCase()).not.toContain("password");
  });

  it("reads Google metadata from an auth.users row", () => {
    const info = infoFromAuthRecord({
      id: "user-1",
      email: "a@example.com",
      created_at: "2026-08-18T00:00:00.000Z",
      email_confirmed_at: "2026-08-18T00:00:01.000Z",
      raw_app_meta_data: { provider: "google", providers: ["google"] },
      raw_user_meta_data: { full_name: "花子" },
    });
    expect(info.displayName).toBe("花子");
    expect(info.provider).toBe("google");
    expect(info.emailConfirmed).toBe(true);
  });
});

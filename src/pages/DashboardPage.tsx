import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { shell } from "../theme/choreoShell";
import { GuestLanding } from "./home/GuestLanding";
import { HomeLibrary } from "./home/HomeLibrary";
import { homeRootStyle } from "./home/homeChrome";

/** トップ `/` — 未ログインは紹介、ログイン後はライブラリホーム */
export function DashboardPage() {
  const { t } = useI18n();
  const { ready, me } = useAuth();

  if (!ready) {
    return (
      <div
        style={{
          ...homeRootStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: shell.textMuted,
        }}
      >
        {t("common.loading")}
      </div>
    );
  }

  if (!me) return <GuestLanding />;
  return <HomeLibrary />;
}

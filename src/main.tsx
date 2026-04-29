import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/**
 * 本番のみ SW を登録。
 * registerType: "prompt" = controllerchange→reload の自動追加なし。
 * onNeedRefresh: sessionStorage フラグで 1 セッションにつき 1 回だけ
 * SKIP_WAITING → reload を実行。これによりループを完全に防ぐ。
 */
if (import.meta.env.PROD) {
  const RELOAD_KEY = "__cc_sw_reloaded";
  registerSW({
    onNeedRefresh() {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.waiting?.postMessage({ type: "SKIP_WAITING" }));
      });
      setTimeout(() => window.location.reload(), 500);
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

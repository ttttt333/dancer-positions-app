import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/** 本番のみ SW を登録。
 * registerType: "prompt" = autoUpdate の controllerchange→reload リスナーなし。
 * onNeedRefresh: 新しい SW を SKIP_WAITING で即時有効化し、300ms 後に 1 回だけリロード。
 * リロード後は新 SW がアクティブ → onNeedRefresh は再発火しない → ループなし。
 */
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.waiting?.postMessage({ type: "SKIP_WAITING" }));
      });
      setTimeout(() => window.location.reload(), 300);
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

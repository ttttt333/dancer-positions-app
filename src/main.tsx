import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/** 開発中に古い SW が残ると真っ白・更新不能になることがあるため本番のみ登録 */
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      /** 新しい SW が待機中 → 即時スキップして有効化（ページリロード不要） */
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.waiting?.postMessage({ type: "SKIP_WAITING" }));
      });
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

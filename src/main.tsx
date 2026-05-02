import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import "./styles/mobile-override.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/**
 * 本番のみ SW を登録。
 * 今日の複数デプロイで古い SW が残っている場合、まず全 SW を unregister して
 * キャッシュをクリアしてからリロードする（1 セッション 1 回限り）。
 * その後 registerSW で新しい SW を登録する。
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const CLEAN_KEY = "__cc_sw_clean_v2";
  if (!sessionStorage.getItem(CLEAN_KEY)) {
    sessionStorage.setItem(CLEAN_KEY, "1");
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (regs.length === 0) return;
      // キャッシュも全削除
      const keys = await caches.keys();
      await Promise.all([
        ...regs.map((r) => r.unregister()),
        ...keys.map((k) => caches.delete(k)),
      ]);
      window.location.reload();
    });
  } else {
    registerSW({
      onNeedRefresh() {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.waiting?.postMessage({ type: "SKIP_WAITING" }));
        });
      },
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

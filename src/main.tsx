import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";
import { warmShareViewFromCurrentPath } from "./lib/shareViewProjectCache";

warmShareViewFromCurrentPath();

/**
 * 本番: SW + キャッシュを全消去してからリロード（毎セッション1回）。
 * SW がない場合でもキャッシュだけ消す。
 * リロード後は SW を再登録しない（PWAキャッシュ問題を根絶）。
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const CLEAN_KEY = "__cc_sw_clean_v5";
  if (!sessionStorage.getItem(CLEAN_KEY)) {
    sessionStorage.setItem(CLEAN_KEY, "1");
    (async () => {
      try {
        const [regs, cacheKeys] = await Promise.all([
          navigator.serviceWorker.getRegistrations(),
          caches.keys(),
        ]);
        await Promise.all([
          ...regs.map((r) => r.unregister()),
          ...cacheKeys.map((k) => caches.delete(k)),
        ]);
        if (regs.length > 0 || cacheKeys.length > 0) {
          window.location.reload();
        }
      } catch {
        // ignore
      }
    })();
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

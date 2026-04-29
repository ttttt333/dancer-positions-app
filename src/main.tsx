import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/** 本番のみ SW を登録。
 * registerType: "prompt" = controllerchange→reload リスナーを生成しない。
 * 新しい SW が待機中になったら SKIP_WAITING でサイレント有効化するだけで、
 * ページを強制リロードしない。ユーザーは次の自然なページ読み込み時に新コンテンツを取得。
 */
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
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

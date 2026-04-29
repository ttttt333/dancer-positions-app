import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/** 本番のみ SW を登録。registerType: "autoUpdate" により新しい SW が
 * 自動インストール・有効化され、デプロイ後に 1 回だけページが更新される。
 * immediate: true は付けない（毎ページロードでの強制チェックを避ける）。
 */
if (import.meta.env.PROD) {
  registerSW();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

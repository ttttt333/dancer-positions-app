import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

/** 本番のみ SW を登録。
 * registerType: "autoUpdate" モードで vite-plugin-pwa が
 * SKIP_WAITING + controllerchange→reload を自動処理する。
 * カスタムコールバックは不要（二重リロードの原因になるため削除）。
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

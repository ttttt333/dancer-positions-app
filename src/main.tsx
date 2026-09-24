import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";
import { warmShareViewFromCurrentPath } from "./lib/shareViewProjectCache";
import { installAudioContextGestureUnlock } from "./lib/audioContext";

warmShareViewFromCurrentPath();
installAudioContextGestureUnlock();

/** Mac Safari 等で古いシェルが残りやすいので、表示復帰時にも更新を取りにいく */
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        void registration.update();
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("focus", check);
      window.setInterval(check, 60_000);
    },
    onNeedRefresh() {
      void updateSW(true);
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

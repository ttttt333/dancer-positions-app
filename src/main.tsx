import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nContext";

const SW_RECOVERY_ONCE_KEY = "dancer-positions-sw-recovery-once";

async function recoverStaleServiceWorker(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (sessionStorage.getItem(SW_RECOVERY_ONCE_KEY) === "1") return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    await Promise.all(regs.map((r) => r.unregister()));
    sessionStorage.setItem(SW_RECOVERY_ONCE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

void (async () => {
  const recovered = await recoverStaleServiceWorker();
  if (recovered) {
    window.location.reload();
    return;
  }

  /** 開発中に古い SW が残ると真っ白・更新不能になることがあるため本番のみ登録 */
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>
  );
})();

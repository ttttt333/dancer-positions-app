import { ExportToast } from "./ExportToast";
import { useAppToastStore } from "../store/appToastStore";

/** アプリ全体で共有する軽いトースト（自動解析エラー等） */
export function AppToastHost() {
  const toast = useAppToastStore((s) => s.toast);
  const dismiss = useAppToastStore((s) => s.dismiss);
  return <ExportToast toast={toast} onDismiss={dismiss} />;
}

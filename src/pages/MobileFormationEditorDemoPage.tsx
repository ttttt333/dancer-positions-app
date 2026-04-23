import { Suspense } from "react";
import { MobileFormationEditorLayout } from "../components/mobileFormationEditor/MobileFormationEditorLayout";

/**
 * モバイル編集レイアウトの見た目デモ（認証不要）。
 * 開発時: http://127.0.0.1:5173/demo/mobile-formation-editor
 */
export function MobileFormationEditorDemoPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#050506",
            color: "#94a3b8",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          読み込み中…
        </div>
      }
    >
      <MobileFormationEditorLayout />
    </Suspense>
  );
}

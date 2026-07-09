import { useCallback, useState } from "react";
import { billingApi } from "../api/client";
import { FREE_VIDEO_EXPORT_LIMIT } from "../lib/entitlements";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { EditorSideSheet } from "./EditorSideSheet";

export type ProUpgradeReason = "export_limit_reached" | "project_limit";

type Props = {
  open: boolean;
  reason: ProUpgradeReason;
  onClose: () => void;
};

export function ProUpgradeModal({ open, reason, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await billingApi.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout の開始に失敗しました");
      setBusy(false);
    }
  }, []);

  const title =
    reason === "export_limit_reached"
      ? "動画書き出しの上限に達しました"
      : "作品数の上限に達しました";

  const description =
    reason === "export_limit_reached"
      ? `無料プランでは動画の書き出しは累計${FREE_VIDEO_EXPORT_LIMIT}回までです。PROプランにアップグレードすると無制限に書き出せます。7日間の無料トライアル付き（¥550/月）。`
      : "無料プランではクラウド保存は3作品までです。PROプランで無制限に作成できます。7日間の無料トライアル付き（¥550/月）。";

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      blockDismiss={busy}
      zIndex={100}
      width="min(400px, 92vw)"
      sheetId="pro-upgrade"
      ariaLabelledBy="pro-upgrade-title"
    >
      <div style={{ padding: "18px 20px 22px" }}>
        <h2
          id="pro-upgrade-title"
          style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "#f8fafc" }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#94a3b8",
          }}
        >
          {description}
        </p>
        {error ? (
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171" }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            disabled={busy}
            style={{ ...btnAccent, width: "100%", fontWeight: 700, minHeight: 44 }}
            onClick={() => void startCheckout()}
          >
            {busy ? "準備中…" : "PRO にアップグレード（7日間無料）"}
          </button>
          <button
            type="button"
            disabled={busy}
            style={{ ...btnSecondary, width: "100%" }}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </EditorSideSheet>
  );
}

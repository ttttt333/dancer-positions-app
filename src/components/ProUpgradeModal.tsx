import { useNavigate } from "react-router-dom";
import {
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
  FREE_VIDEO_EXPORT_LIMIT,
} from "../lib/entitlements";
import {
  PLAN_CONFIRM_PATH,
  PRO_PRICE_YEN_TAX_IN,
  PRO_TRIAL_DAYS,
} from "../lib/commercialDisclosure";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { EditorSideSheet } from "./EditorSideSheet";

export type ProUpgradeReason =
  | "export_limit_reached"
  | "project_limit"
  | "dancer_limit"
  | "cue_limit";

type Props = {
  open: boolean;
  reason: ProUpgradeReason;
  onClose: () => void;
};

export function ProUpgradeModal({ open, reason, onClose }: Props) {
  const navigate = useNavigate();

  const goConfirm = () => {
    onClose();
    navigate(PLAN_CONFIRM_PATH);
  };

  const title =
    reason === "export_limit_reached"
      ? "動画書き出しの上限に達しました"
      : reason === "project_limit"
        ? "作品数の上限に達しました"
        : reason === "dancer_limit"
          ? "人数の上限に達しました"
          : "キュー数の上限に達しました";

  const description =
    reason === "export_limit_reached"
      ? `無料プランでは動画の書き出しは累計${FREE_VIDEO_EXPORT_LIMIT}回までです。PROプランにアップグレードすると無制限に書き出せます。${PRO_TRIAL_DAYS}日間の無料トライアルのあと月額${PRO_PRICE_YEN_TAX_IN}円（税込・自動更新）。`
      : reason === "project_limit"
        ? `無料プランではクラウド保存は3作品までです。PROプランで無制限に作成できます。${PRO_TRIAL_DAYS}日間の無料トライアルのあと月額${PRO_PRICE_YEN_TAX_IN}円（税込・自動更新）。`
        : reason === "dancer_limit"
          ? `無料プランでは1フォーメーションあたり人数は${FREE_MAX_DANCERS}人までです。${FREE_MAX_DANCERS + 1}人以上にするにはPROプランが必要です。${PRO_TRIAL_DAYS}日間の無料トライアルのあと月額${PRO_PRICE_YEN_TAX_IN}円（税込・自動更新）。`
          : `無料プランではキューは${FREE_MAX_CUES}個までです。${FREE_MAX_CUES + 1}個以上にするにはPROプランが必要です。${PRO_TRIAL_DAYS}日間の無料トライアルのあと月額${PRO_PRICE_YEN_TAX_IN}円（税込・自動更新）。`;

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            style={{ ...btnAccent, width: "100%", fontWeight: 700, minHeight: 44 }}
            onClick={goConfirm}
          >
            PRO にアップグレード（内容を確認）
          </button>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.45,
              color: "#64748b",
              textAlign: "center",
            }}
          >
            月額（カード）または年額 5,500円（PayPay / カード）を選べます
          </p>
          <button
            type="button"
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

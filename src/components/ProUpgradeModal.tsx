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
import { useI18n } from "../i18n/I18nContext";
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
  const { t } = useI18n();

  const goConfirm = () => {
    onClose();
    navigate(PLAN_CONFIRM_PATH);
  };

  const title =
    reason === "export_limit_reached"
      ? t("pro.upgrade.title.export")
      : reason === "project_limit"
        ? t("pro.upgrade.title.project")
        : reason === "dancer_limit"
          ? t("pro.upgrade.title.dancer")
          : t("pro.upgrade.title.cue");

  const description =
    reason === "export_limit_reached"
      ? t("pro.upgrade.desc.export", {
          limit: FREE_VIDEO_EXPORT_LIMIT,
          days: PRO_TRIAL_DAYS,
          price: PRO_PRICE_YEN_TAX_IN,
        })
      : reason === "project_limit"
        ? t("pro.upgrade.desc.project", {
            days: PRO_TRIAL_DAYS,
            price: PRO_PRICE_YEN_TAX_IN,
          })
        : reason === "dancer_limit"
          ? t("pro.upgrade.desc.dancer", {
              limit: FREE_MAX_DANCERS,
              min: FREE_MAX_DANCERS + 1,
              days: PRO_TRIAL_DAYS,
              price: PRO_PRICE_YEN_TAX_IN,
            })
          : t("pro.upgrade.desc.cue", {
              limit: FREE_MAX_CUES,
              min: FREE_MAX_CUES + 1,
              days: PRO_TRIAL_DAYS,
              price: PRO_PRICE_YEN_TAX_IN,
            });

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
            {t("pro.upgrade.cta")}
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
            {t("pro.upgrade.hint")}
          </p>
          <button
            type="button"
            style={{ ...btnSecondary, width: "100%" }}
            onClick={onClose}
          >
            {t("pro.upgrade.close")}
          </button>
        </div>
      </div>
    </EditorSideSheet>
  );
}

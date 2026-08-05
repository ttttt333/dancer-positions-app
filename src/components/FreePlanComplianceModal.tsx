import type { CSSProperties } from "react";
import {
  FREE_CLOUD_PROJECT_LIMIT,
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
  type FreePlanExcessReport,
} from "../lib/freePlanCompliance";
import { PLAN_CONFIRM_PATH } from "../lib/commercialDisclosure";
import { useI18n } from "../i18n/I18nContext";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

type Props = {
  open: boolean;
  report: FreePlanExcessReport | null;
  busy: boolean;
  onConfirmTrim: () => void;
  onGoPro: () => void;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "rgba(2, 6, 23, 0.72)",
  display: "grid",
  placeItems: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "min(86vh, 720px)",
  overflow: "auto",
  borderRadius: 14,
  border: `1px solid ${shell.borderStrong}`,
  background: shell.bgChrome,
  color: shell.text,
  padding: "18px 18px 16px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
};

/**
 * PRO 終了・無料復帰後に超過データを削減する注意書き＋実行確認。
 * 閉じても再度ライブラリ表示時に出る（超過が残る限り）。
 */
export function FreePlanComplianceModal({
  open,
  report,
  busy,
  onConfirmTrim,
  onGoPro,
}: Props) {
  const { t } = useI18n();
  if (!open || !report) return null;

  return (
    <div style={backdrop} role="dialog" aria-modal aria-labelledby="free-compliance-title">
      <div style={card}>
        <h2
          id="free-compliance-title"
          style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 750 }}
        >
          {t("free.compliance.title")}
        </h2>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            lineHeight: 1.6,
            color: shell.textMuted,
          }}
        >
          {t("free.compliance.lead", {
            projects: FREE_CLOUD_PROJECT_LIMIT,
            cues: FREE_MAX_CUES,
            dancers: FREE_MAX_DANCERS,
          })}
        </p>

        {report.projectsToDelete.length > 0 ? (
          <section style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>
              {t("free.compliance.deleteProjects", {
                n: report.projectsToDelete.length,
                keep: FREE_CLOUD_PROJECT_LIMIT,
              })}
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                color: "#fca5a5",
                lineHeight: 1.5,
              }}
            >
              {report.projectsToDelete.map((p) => (
                <li key={p.id}>{p.name || t("free.compliance.untitled")}</li>
              ))}
            </ul>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: shell.textSubtle }}>
              {t("free.compliance.keepNewest")}
            </p>
          </section>
        ) : null}

        {report.projectsNeedingContentTrim.length > 0 ? (
          <section style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>
              {t("free.compliance.trimContent")}
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                color: "#fde68a",
                lineHeight: 1.5,
              }}
            >
              {report.projectsNeedingContentTrim.map((p) => (
                <li key={p.id}>
                  {(p.name || t("free.compliance.untitled")) +
                    " — " +
                    [
                      p.cuesToRemove > 0
                        ? t("free.compliance.trimCues", { n: p.cuesToRemove })
                        : null,
                      p.dancersToRemove > 0
                        ? t("free.compliance.trimDancers", {
                            n: p.dancersToRemove,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            lineHeight: 1.5,
            color: shell.textMuted,
          }}
        >
          {t("free.compliance.warning")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            style={{ ...btnAccent, width: "100%", fontWeight: 700, minHeight: 44 }}
            disabled={busy}
            onClick={onConfirmTrim}
          >
            {busy
              ? t("free.compliance.busy")
              : t("free.compliance.confirm")}
          </button>
          <button
            type="button"
            style={{ ...btnSecondary, width: "100%", minHeight: 40 }}
            disabled={busy}
            onClick={onGoPro}
          >
            {t("free.compliance.goPro")}
          </button>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: shell.textSubtle,
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            {t("free.compliance.footer", { path: PLAN_CONFIRM_PATH })}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { getToken, isDemoSessionToken } from "../../api/client";
import { useI18n } from "../../i18n/I18nContext";
import { downloadBlob } from "../../lib/downloadBlob";
import {
  importPortableArchiveJsonAsync,
  PORTABLE_ARCHIVE_FORMAT,
  type PortableArchiveV1,
} from "../../lib/portableChoreoBackup";
import { exportPortableArchiveZipAsync } from "../../lib/portableChoreoBackupZip";
import { yieldToMain, deferAfterUserGesture } from "../../lib/yieldToMain";
import { btnSecondary } from "../stageButtonStyles";
import { panelCard, shell } from "../../theme/choreoShell";

type Props = {
  loggedIn: boolean;
};

export function PortableBackupSection({ loggedIn }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const runExport = useCallback(
    (includeCloudProjects: boolean) => {
      deferAfterUserGesture(async () => {
        setBusy(true);
        setNotice("");
        await yieldToMain();
        try {
          const { blob, filename } = await exportPortableArchiveZipAsync({
            includeCloudProjects,
          });
          downloadBlob(blob, filename);
          setNotice(t("dashboard.portableExportOk"));
        } catch (e) {
          setNotice(e instanceof Error ? e.message : t("dashboard.portableExportFail"));
        } finally {
          setBusy(false);
        }
      });
    },
    [t]
  );

  const onImportClick = useCallback(() => {
    if (!confirm(t("dashboard.portableImportConfirm"))) return;
    importInputRef.current?.click();
  }, [t]);

  const onImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBusy(true);
      setNotice("");
      try {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          setNotice(t("dashboard.portableImportParseFail"));
          return;
        }
        const archive = parsed as PortableArchiveV1;
        if (archive?.format !== PORTABLE_ARCHIVE_FORMAT) {
          setNotice(t("dashboard.portableImportFormatFail"));
          return;
        }
        const cloudCount = archive.cloudProjects?.length ?? 0;
        let importCloud = false;
        if (
          cloudCount > 0 &&
          loggedIn &&
          getToken() &&
          !isDemoSessionToken() &&
          confirm(t("dashboard.portableImportCloudConfirm").replace("{n}", String(cloudCount)))
        ) {
          importCloud = true;
        }
        const result = await importPortableArchiveJsonAsync(text, {
          importCloudProjectsAsNew: importCloud,
        });
        setNotice(result.ok ? result.message : result.message || t("dashboard.portableImportFail"));
      } catch (err) {
        setNotice(err instanceof Error ? err.message : t("dashboard.portableImportFail"));
      } finally {
        setBusy(false);
      }
    },
    [loggedIn, t]
  );

  const canExportCloud =
    loggedIn && Boolean(getToken()) && !isDemoSessionToken();

  return (
    <section style={{ ...panelCard, padding: "16px 18px", marginTop: 28 }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: "15px",
          fontWeight: 700,
        }}
      >
        {t("dashboard.portableTitle")}
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: "13px", color: shell.textMuted, lineHeight: 1.55 }}>
        {t("dashboard.portableDesc")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={{ ...btnSecondary, fontSize: "13px", padding: "8px 14px" }}
          disabled={busy}
          onClick={() => void runExport(false)}
        >
          {busy ? t("common.loading") : t("dashboard.portableExportLocal")}
        </button>
        {canExportCloud ? (
          <button
            type="button"
            style={{ ...btnSecondary, fontSize: "13px", padding: "8px 14px" }}
            disabled={busy}
            onClick={() => void runExport(true)}
          >
            {busy ? t("common.loading") : t("dashboard.portableExportWithCloud")}
          </button>
        ) : null}
        <button
          type="button"
          style={{ ...btnSecondary, fontSize: "13px", padding: "8px 14px" }}
          disabled={busy}
          onClick={onImportClick}
        >
          {t("dashboard.portableImport")}
        </button>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => void onImportFile(e)}
      />
      {notice ? (
        <p style={{ margin: "12px 0 0", fontSize: "13px", color: shell.textMuted, lineHeight: 1.5 }}>
          {notice}
        </p>
      ) : null}
      <p style={{ margin: "12px 0 0", fontSize: "11px", color: shell.textSubtle, lineHeight: 1.5 }}>
        {t("dashboard.portableFootnote")}
      </p>
    </section>
  );
}

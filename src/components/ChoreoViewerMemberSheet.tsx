import {
  type StudentPick,
  ChoreoMemberPickerPanel,
} from "./ChoreoStudentViewGate";
import { btnSecondary } from "./stageButtonStyles";
import type { ViewRosterEntry } from "../lib/viewRoster";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  open: boolean;
  entries: ViewRosterEntry[];
  onClose: () => void;
  onPick: (p: StudentPick) => void;
};

/** 生徒閲覧: 下からスライドするメンバー選択（全員スクロール可能） */
export function ChoreoViewerMemberSheet({
  open,
  entries,
  onClose,
  onPick,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="choreo-viewer-member-sheet" aria-hidden={false}>
      <button
        type="button"
        className="choreo-viewer-member-sheet__backdrop"
        aria-label={t("editor.layout.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="choreo-viewer-member-sheet-title"
        className="choreo-viewer-member-sheet__panel"
      >
        <div className="choreo-viewer-member-sheet__header">
          <h3 id="choreo-viewer-member-sheet-title">
            {t("editor.layout.selectPartTitle")}
          </h3>
          <button
            type="button"
            aria-label={t("editor.layout.close")}
            onClick={onClose}
            style={{
              ...btnSecondary,
              fontSize: 18,
              lineHeight: 1,
              padding: "4px 12px",
            }}
          >
            ×
          </button>
        </div>
        <div className="choreo-viewer-member-sheet__body">
          <ChoreoMemberPickerPanel
            entries={entries}
            onPick={onPick}
            compact
            publicSheet
          />
        </div>
      </div>
    </div>
  );
}

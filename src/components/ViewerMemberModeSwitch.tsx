import type { StudentPick } from "./ChoreoStudentViewGate";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  pick: StudentPick;
  /** 名簿 0 人のときは非表示 */
  memberCount: number;
  compact?: boolean;
  onPickAll: () => void;
  onPickIndividual: () => void;
  onOpenMemberPicker?: () => void;
};

/** 再生中でもシートを開かずに全体／個人を切り替えるセグメント */
export function ViewerMemberModeSwitch({
  pick,
  memberCount,
  compact = false,
  onPickAll,
  onPickIndividual,
  onOpenMemberPicker,
}: Props) {
  const { t } = useI18n();
  if (memberCount === 0) return null;

  const isAll = pick.kind === "all";
  const individualLabel =
    pick.kind === "member"
      ? pick.label.trim() || t("editor.layout.viewerModeIndividual")
      : t("editor.layout.viewerModeIndividual");

  return (
    <div
      className={[
        "choreo-viewer-member-mode",
        compact ? "choreo-viewer-member-mode--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={t("editor.layout.viewerModeSwitchAria")}
    >
      <button
        type="button"
        className={[
          "choreo-viewer-member-mode__seg",
          isAll ? "choreo-viewer-member-mode__seg--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={isAll}
        onClick={() => {
          if (!isAll) onPickAll();
        }}
      >
        {t("editor.layout.viewerModeAll")}
      </button>
      <button
        type="button"
        className={[
          "choreo-viewer-member-mode__seg",
          !isAll ? "choreo-viewer-member-mode__seg--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={!isAll}
        title={
          pick.kind === "member"
            ? `${individualLabel}${t("editor.layout.memberSuffix")}`
            : undefined
        }
        onClick={() => {
          if (isAll) onPickIndividual();
        }}
      >
        <span className="choreo-viewer-member-mode__seg-label">
          {individualLabel}
        </span>
      </button>
      {!isAll && memberCount > 1 && onOpenMemberPicker ? (
        <button
          type="button"
          className="choreo-viewer-member-mode__change"
          aria-label={t("editor.layout.viewerModeChangeMemberTitle")}
          title={t("editor.layout.viewerModeChangeMemberTitle")}
          onClick={onOpenMemberPicker}
        >
          {t("editor.layout.viewerModeChangeMember")}
        </button>
      ) : null}
    </div>
  );
}

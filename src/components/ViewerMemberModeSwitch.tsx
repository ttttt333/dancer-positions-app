import type { StudentPick } from "./ChoreoStudentViewGate";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  pick: StudentPick;
  /** 名簿 0 人のときは非表示 */
  memberCount: number;
  layout?: "inline" | "stack";
  /** 下部バー向けのコンパクト表示 */
  compact?: boolean;
  onPickAll: () => void;
  onPickIndividual: () => void;
  onOpenMemberPicker?: () => void;
};

/** 全体 / 個人（名前）の2択セグメント — 生徒閲覧の最重要操作 */
export function ViewerMemberModeSwitch({
  pick,
  memberCount,
  layout = "inline",
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

  const onIndividualClick = () => {
    if (isAll) {
      if (memberCount > 1) {
        onOpenMemberPicker?.();
        return;
      }
      onPickIndividual();
      return;
    }
    onOpenMemberPicker?.();
  };

  return (
    <div
      className={[
        "choreo-viewer-member-mode",
        layout === "stack" ? "choreo-viewer-member-mode--stack" : "",
        compact ? "choreo-viewer-member-mode--compact-bar" : "",
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
          !isAll && pick.kind === "member"
            ? `${individualLabel}${t("editor.layout.memberSuffix")}`
            : t("editor.layout.viewerModeChangeMemberTitle")
        }
        onClick={onIndividualClick}
      >
        <span className="choreo-viewer-member-mode__seg-label">
          {individualLabel}
        </span>
      </button>
    </div>
  );
}

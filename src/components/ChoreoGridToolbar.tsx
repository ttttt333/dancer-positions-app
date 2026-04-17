import { btnSecondary } from "./StageBoard";

type Props = {
  snapGrid: boolean;
  onToggleSnapGrid: () => void;
  hanamichiEnabled: boolean;
  onToggleHanamichi: () => void;
  /** 図形・色を選ぶ大道具追加ダイアログを開く */
  onOpenSetPiecePicker: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenExport: () => void;
  disabled?: boolean;
};

/**
 * ChoreoGrid 左端ツールバー（仕様の一部。書き出し等はヘッダ／インスペクタと併用）。
 */
export function ChoreoGridToolbar({
  snapGrid,
  onToggleSnapGrid,
  hanamichiEnabled,
  onToggleHanamichi,
  onOpenSetPiecePicker,
  onOpenShortcutsHelp,
  onOpenExport,
  disabled = false,
}: Props) {
  return (
    <aside
      aria-label="ChoreoGrid ツール"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "10px 6px",
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: "10px",
        minWidth: 48,
        maxWidth: 52,
      }}
    >
      <div
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#64748b",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          userSelect: "none",
        }}
      >
        ChoreoGrid
      </div>
      <button
        type="button"
        disabled={disabled}
        title="スナップグリッドの表示・切替（ステージのチェックボックスと同期）"
        style={{
          ...btnSecondary,
          padding: "6px 4px",
          fontSize: "11px",
          lineHeight: 1.2,
          width: "100%",
          borderColor: snapGrid ? "#6366f1" : undefined,
          color: snapGrid ? "#c7d2fe" : undefined,
        }}
        onClick={onToggleSnapGrid}
      >
        グリッド
      </button>
      <button
        type="button"
        disabled={disabled}
        title="花道（客席側の帯）の表示"
        style={{
          ...btnSecondary,
          padding: "6px 4px",
          fontSize: "11px",
          lineHeight: 1.2,
          width: "100%",
          borderColor: hanamichiEnabled ? "#0d9488" : undefined,
          color: hanamichiEnabled ? "#99f6e4" : undefined,
        }}
        onClick={onToggleHanamichi}
      >
        花道
      </button>
      <button
        type="button"
        disabled={disabled}
        title="選択中キュー（またはアクティブ）のフォーメーションに大道具を追加（図形・色を選べます）"
        style={{
          ...btnSecondary,
          padding: "6px 4px",
          fontSize: "11px",
          lineHeight: 1.2,
          width: "100%",
        }}
        onClick={onOpenSetPiecePicker}
      >
        大道具
      </button>
      <button
        type="button"
        disabled={disabled}
        title="書き出し（PNG / PDF / 動画 WebM / JSON）"
        style={{
          ...btnSecondary,
          padding: "6px 4px",
          fontSize: "10px",
          lineHeight: 1.2,
          width: "100%",
        }}
        onClick={onOpenExport}
      >
        書出
      </button>
      <button
        type="button"
        disabled={disabled}
        title="キーボードショートカット一覧"
        style={{
          ...btnSecondary,
          padding: "6px 4px",
          fontSize: "12px",
          lineHeight: 1.2,
          width: "100%",
          fontWeight: 700,
        }}
        onClick={onOpenShortcutsHelp}
      >
        ?
      </button>
      <div
        style={{
          fontSize: "9px",
          color: "#475569",
          textAlign: "center",
          lineHeight: 1.35,
          marginTop: 4,
        }}
      >
        取り込みはヘッダ／右パネル
      </div>
    </aside>
  );
}

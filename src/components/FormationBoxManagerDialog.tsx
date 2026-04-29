import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { DancerSpot } from "../types/choreography";
import {
  deleteFormationBoxItem,
  FORMATION_BOX_CHANGE_EVENT,
  listFormationBoxItems,
  renameFormationBoxItem,
  saveFormationToBox,
  updateFormationBoxItem,
  type FormationBoxItem,
} from "../lib/formationBox";
import { FormationBoxItemThumb } from "./FormationBoxItemThumb";
import { EditorSideSheet } from "./EditorSideSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 現在ステージに表示されているダンサー（新規保存・上書き時に使用） */
  currentDancers: DancerSpot[];
};

const inputBase: CSSProperties = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "6px 10px",
  color: "#e2e8f0",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimary: CSSProperties = {
  background: "#14532d",
  border: "1px solid #166534",
  borderRadius: "8px",
  color: "#dcfce7",
  fontSize: "13px",
  fontWeight: 600,
  padding: "7px 14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnDanger: CSSProperties = {
  background: "transparent",
  border: "1px solid #7f1d1d",
  borderRadius: "6px",
  color: "#fca5a5",
  fontSize: "12px",
  padding: "4px 8px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnSecondary: CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  borderRadius: "6px",
  color: "#94a3b8",
  fontSize: "12px",
  padding: "4px 8px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function fmtDate(t: number): string {
  try {
    const d = new Date(t);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

type ItemRowProps = {
  item: FormationBoxItem;
  currentDancers: DancerSpot[];
  onRefresh: () => void;
};

function ItemRow({ item, currentDancers, onRefresh }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [feedback, setFeedback] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleRenameStart = () => {
    setEditName(item.name);
    setEditing(true);
    setTimeout(() => nameInputRef.current?.focus(), 30);
  };

  const handleRenameCommit = () => {
    if (editName.trim()) {
      renameFormationBoxItem(item.id, editName.trim());
      onRefresh();
    }
    setEditing(false);
  };

  const handleOverwrite = () => {
    if (currentDancers.length === 0) {
      showFeedback("ステージにダンサーがいません");
      return;
    }
    const result = updateFormationBoxItem(item.id, currentDancers);
    if (result.ok) {
      showFeedback("上書き完了");
      onRefresh();
    } else {
      showFeedback(result.message);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
    deleteFormationBoxItem(item.id);
    onRefresh();
  };

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: "10px",
        background: "#0b1220",
        padding: "10px 12px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      {/* サムネイル */}
      <div
        style={{
          flexShrink: 0,
          background: "#020617",
          border: "1px solid #1e293b",
          borderRadius: "6px",
          padding: "4px",
          color: "#38bdf8",
        }}
      >
        <FormationBoxItemThumb item={item} width={60} />
      </div>

      {/* 情報 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        {editing ? (
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              ref={nameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCommit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{ ...inputBase, fontSize: "13px", padding: "4px 8px" }}
            />
            <button type="button" style={btnPrimary} onClick={handleRenameCommit}>
              確定
            </button>
            <button type="button" style={btnSecondary} onClick={() => setEditing(false)}>
              ✕
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#e2e8f0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            title="クリックして名前を変更"
            onClick={handleRenameStart}
          >
            {item.name}
          </div>
        )}

        <div style={{ fontSize: "11px", color: "#64748b" }}>
          {item.dancerCount}人 · {fmtDate(item.updatedAt)}
        </div>

        {feedback && (
          <div style={{ fontSize: "11px", color: "#4ade80" }}>{feedback}</div>
        )}
      </div>

      {/* アクションボタン */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0 }}>
        <button
          type="button"
          style={btnSecondary}
          title="現在のステージの立ち位置で上書き"
          onClick={handleOverwrite}
        >
          ↻ 上書き
        </button>
        <button
          type="button"
          style={btnDanger}
          title="この立ち位置を削除"
          onClick={handleDelete}
        >
          削除
        </button>
      </div>
    </div>
  );
}

type GroupedListProps = {
  items: FormationBoxItem[];
  currentDancers: DancerSpot[];
  onRefresh: () => void;
};

/** 人数ごとにグループ化して表示するリスト。グループは折りたたみ可。 */
function GroupedItemList({ items, currentDancers, onRefresh }: GroupedListProps) {
  // 人数の昇順でグループ化（同じ人数をまとめる）
  const groups = (() => {
    const map = new Map<number, FormationBoxItem[]>();
    for (const item of items) {
      const arr = map.get(item.dancerCount) ?? [];
      arr.push(item);
      map.set(item.dancerCount, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([count, groupItems]) => ({ count, groupItems }));
  })();

  // 初期状態: 全グループ展開
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleGroup = (count: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(count)) next.delete(count);
      else next.add(count);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* 合計件数ヘッダ */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        保存済み（{items.length}件 / {groups.length}グループ）
      </div>

      {groups.map(({ count, groupItems }) => {
        const isOpen = !collapsed.has(count);
        return (
          <div key={count}>
            {/* グループヘッダ（折りたたみトグル） */}
            <button
              type="button"
              onClick={() => toggleGroup(count)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                width: "100%",
                background: "none",
                border: "none",
                padding: "5px 0",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: isOpen ? "#38bdf8" : "#64748b",
                  transition: "transform 0.15s",
                  display: "inline-block",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  lineHeight: 1,
                }}
              >
                ▶
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: isOpen ? "#cbd5e1" : "#64748b",
                  letterSpacing: "0.02em",
                }}
              >
                {count}人
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#475569",
                  marginLeft: "2px",
                }}
              >
                {groupItems.length}件
              </span>
              <span
                style={{
                  flex: 1,
                  height: "1px",
                  background: "#1e293b",
                  marginLeft: "4px",
                }}
              />
            </button>

            {/* グループ内アイテム */}
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "0px" }}>
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    currentDancers={currentDancers}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 「立ち位置保存」ボタンから開く管理ダイアログ。
 * - 現在のステージを新規保存
 * - 保存済みの立ち位置の一覧表示・名前変更・上書き・削除
 */
export function FormationBoxManagerDialog({ open, onClose, currentDancers }: Props) {
  const [items, setItems] = useState<FormationBoxItem[]>([]);
  const [newName, setNewName] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const refresh = useCallback(() => {
    setItems(listFormationBoxItems());
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setNewName("");
      setSaveFeedback(null);
    }
  }, [open, refresh]);

  useEffect(() => {
    window.addEventListener(FORMATION_BOX_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(FORMATION_BOX_CHANGE_EVENT, refresh);
  }, [refresh]);

  const handleSaveNew = useCallback(() => {
    if (currentDancers.length === 0) {
      setSaveFeedback({ type: "err", msg: "ステージにダンサーがいません。" });
      return;
    }
    const trimmed = newName.trim();
    const fallback = `${currentDancers.length}人の形 ${items.filter((x) => x.dancerCount === currentDancers.length).length + 1}`;
    const result = saveFormationToBox(trimmed || fallback, currentDancers);
    if (result.ok) {
      setSaveFeedback({ type: "ok", msg: `「${result.item.name}」を保存しました` });
      setNewName("");
      refresh();
    } else {
      setSaveFeedback({ type: "err", msg: result.message });
    }
  }, [currentDancers, newName, items, refresh]);

  const headerId = "fbm-dialog-title";

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      width="min(420px, 90vw)"
      zIndex={72}
      ariaLabelledBy={headerId}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "#060e1c",
          color: "#e2e8f0",
          fontFamily: "inherit",
        }}
      >
        {/* ヘッダ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: "1px solid #1e293b",
            flexShrink: 0,
          }}
        >
          <h2
            id={headerId}
            style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f1f5f9" }}
          >
            立ち位置の管理
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* 新規保存エリア */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e293b",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
            }}
          >
            現在のステージを保存
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={
                currentDancers.length > 0
                  ? `${currentDancers.length}人の形 ${items.filter((x) => x.dancerCount === currentDancers.length).length + 1}`
                  : "立ち位置の名前（省略可）"
              }
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNew();
              }}
              style={inputBase}
            />
            <button
              type="button"
              style={{
                ...btnPrimary,
                opacity: currentDancers.length === 0 ? 0.4 : 1,
              }}
              disabled={currentDancers.length === 0}
              onClick={handleSaveNew}
            >
              ＋ 保存
            </button>
          </div>
          {saveFeedback && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: saveFeedback.type === "ok" ? "#4ade80" : "#f87171",
              }}
            >
              {saveFeedback.msg}
            </div>
          )}
        </div>

        {/* 保存済み一覧 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#475569",
                fontSize: "13px",
                marginTop: "32px",
                lineHeight: 1.7,
              }}
            >
              保存された立ち位置はありません。
              <br />
              上のボタンから現在のステージを保存できます。
            </div>
          ) : (
            <GroupedItemList
              items={items}
              currentDancers={currentDancers}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>
    </EditorSideSheet>
  );
}

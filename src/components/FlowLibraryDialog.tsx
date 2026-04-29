import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  FLOW_LIBRARY_CHANGE_EVENT,
  applyFlowStageSettingsToProject,
  ensureCrewsFromFormationsIfEmpty,
  type FlowLibraryItem,
  deleteFlowItem,
  expandFlowToProject,
  exportFlowLibraryJsonAsync,
  importFlowLibraryJsonAsync,
  listFlowLibraryItems,
  overwriteFlowFromProject,
  renameFlowItem,
  saveFlowFromProject,
} from "../lib/flowLibrary";
import { deleteFlowLibraryAudio, putFlowLibraryAudio } from "../lib/flowLibraryLocalAudio";
import { btnSecondary } from "./stageButtonStyles";
import { EditorSideSheet } from "./EditorSideSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: (
    next: ChoreographyProjectJson | ((p: ChoreographyProjectJson) => ChoreographyProjectJson)
  ) => void;
  /** 楽曲の総尺（秒）。タイミングを置換しないとき、キューを等間隔で配り直す基準。 */
  audioDurationSec: number;
  /** フロー保存時に波形ピークを同梱する（タイムラインから取得） */
  getWavePeaks?: () => number[] | null;
  /** フロー読み込み後に波形を即復元（秒尺つき） */
  onRestoreWaveform?: (peaks: number[], durationSec?: number) => void;
  /**
   * フロー保存用: 現在 `<audio>` に出ている音源（blob URL 等）を取得。
   * サーバ音源のみのときは呼び出し元で null を返してよい（memento の audioAssetId だけで足りる）
   */
  getAudioBlobForFlowLibrary?: () => Promise<Blob | null>;
};

const card: CSSProperties = {
  border: "1px solid #1f2937",
  borderRadius: "10px",
  background: "#0b1220",
  padding: "10px 12px",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputBase: CSSProperties = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "6px 10px",
  color: "#e2e8f0",
  fontSize: "13px",
  outline: "none",
};

function fmtCount(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

function fmtDate(t: number): string {
  try {
    const d = new Date(t);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

/** 1 行ぶんの「フォーメーション簡易プレビュー」（横並び） */
function FlowMiniRow({ item }: { item: FlowLibraryItem }) {
  const cells = item.cues.slice(0, 12);
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        alignItems: "stretch",
        height: "32px",
      }}
      aria-hidden
    >
      {cells.map((c, i) => {
        const f = item.formations.find((x) => x.id === c.formationIdRef);
        return (
          <svg
            key={c.id || i}
            viewBox="0 0 100 100"
            width={32}
            height={32}
            style={{
              background: "#020617",
              border: "1px solid #1f2937",
              borderRadius: "4px",
              flexShrink: 0,
            }}
          >
            {(f?.dancers ?? []).map((d, j) => (
              <circle
                key={j}
                cx={d.xPct}
                cy={d.yPct}
                r={5}
                fill="#22d3ee"
                opacity={0.85}
              />
            ))}
          </svg>
        );
      })}
      {item.cues.length > cells.length ? (
        <div
          style={{
            alignSelf: "center",
            color: "#64748b",
            fontSize: "11px",
            paddingLeft: "4px",
          }}
        >
          …+{item.cues.length - cells.length}
        </div>
      ) : null}
    </div>
  );
}

/**
 * フローライブラリのダイアログ。
 * - 上半分: 現在のプロジェクトを「新しいフロー」として保存
 * - 下半分: 端末に保存済みのフロー一覧（読み込み・上書き・名前変更・削除）
 * - フッタ: バックアップ JSON のエクスポート／取り込み
 */
export function FlowLibraryDialog({
  open,
  onClose,
  project,
  setProject,
  audioDurationSec,
  getWavePeaks,
  onRestoreWaveform,
  getAudioBlobForFlowLibrary,
}: Props) {
  const [items, setItems] = useState<FlowLibraryItem[]>([]);
  const [name, setName] = useState("");
  /** 軽量キュー配列に秒を載せるか。バンドルでは cuesFull に常にフル秒が入る */
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setItems(listFlowLibraryItems());
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    setFeedback(null);
    if (!name) {
      const base = project.pieceTitle?.trim() || "フロー";
      setName(`${base} ${new Date().toLocaleDateString("ja-JP")}`);
    }
    const onChanged = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.includes("flow_library")) refresh();
    };
    window.addEventListener(FLOW_LIBRARY_CHANGE_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FLOW_LIBRARY_CHANGE_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cuesCount = project.cues.length;
  const formCount = project.formations.length;
  const dancerCount = useMemo(() => {
    if (project.formations.length === 0) return 0;
    const active =
      project.formations.find((f) => f.id === project.activeFormationId) ??
      project.formations[0];
    return active?.dancers.length ?? 0;
  }, [project.formations, project.activeFormationId]);

  const doSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFeedback({ kind: "error", text: "名前を入力してください。" });
      return;
    }
    setBusy(true);
    let flowEmbeddedAudioKey: string | null = null;
    try {
      if (project.audioAssetId == null && getAudioBlobForFlowLibrary) {
        const b = await getAudioBlobForFlowLibrary();
        if (b && b.size > 0) {
          const k = crypto.randomUUID();
          await putFlowLibraryAudio(k, b);
          flowEmbeddedAudioKey = k;
        }
      }
      const r = saveFlowFromProject(trimmed, project, {
        includeTiming: true,
        wavePeaks: getWavePeaks?.() ?? null,
        audioDurationSec: audioDurationSec > 0 ? audioDurationSec : null,
        flowEmbeddedAudioKey: flowEmbeddedAudioKey ?? null,
      });
      if (!r.ok) {
        if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
        setFeedback({ kind: "error", text: r.message });
        return;
      }
      setFeedback({
        kind: "info",
        text: `「${r.item.name}」を保存しました（キュー ${r.item.cueCount} / 形 ${r.item.formations.length}）。`,
      });
      refresh();
    } catch (e) {
      if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "保存中にエラーが発生しました。",
      });
    } finally {
      setBusy(false);
    }
  }, [name, project, refresh, getWavePeaks, getAudioBlobForFlowLibrary, audioDurationSec]);

  const doOverwrite = useCallback(
    async (id: string, label: string) => {
      if (!confirm(`「${label}」を現在のステージ内容で上書きします。よろしいですか？`)) return;
      setBusy(true);
      let flowEmbeddedAudioKey: string | null = null;
      try {
        if (project.audioAssetId == null && getAudioBlobForFlowLibrary) {
          const b = await getAudioBlobForFlowLibrary();
          if (b && b.size > 0) {
            const k = crypto.randomUUID();
            await putFlowLibraryAudio(k, b);
            flowEmbeddedAudioKey = k;
          }
        }
        const r = overwriteFlowFromProject(id, project, {
          includeTiming: true,
          wavePeaks: getWavePeaks?.() ?? null,
          audioDurationSec: audioDurationSec > 0 ? audioDurationSec : null,
          flowEmbeddedAudioKey: flowEmbeddedAudioKey ?? null,
        });
        if (!r.ok) {
          if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
          setFeedback({ kind: "error", text: r.message });
          return;
        }
        setFeedback({ kind: "info", text: `「${r.item.name}」を上書きしました。` });
        refresh();
      } catch (e) {
        if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
        setFeedback({
          kind: "error",
          text: e instanceof Error ? e.message : "上書き中にエラーが発生しました。",
        });
      } finally {
        setBusy(false);
      }
    },
    [project, refresh, getWavePeaks, getAudioBlobForFlowLibrary, audioDurationSec]
  );

  const doDelete = useCallback(
    (id: string, label: string) => {
      if (!confirm(`「${label}」を削除します。よろしいですか？`)) return;
      deleteFlowItem(id);
      refresh();
      setFeedback({ kind: "info", text: `「${label}」を削除しました。` });
    },
    [refresh]
  );

  const doRename = useCallback(
    (id: string, current: string) => {
      const next = window.prompt("新しい名前", current);
      if (!next || next.trim() === current) return;
      const ok = renameFlowItem(id, next.trim());
      if (!ok) {
        setFeedback({ kind: "error", text: "名前の変更に失敗しました。" });
        return;
      }
      refresh();
    },
    [refresh]
  );

  const doApply = useCallback(
    (item: FlowLibraryItem) => {
      const replaceTiming = item.hasTiming
        ? confirm(
            `「${item.name}」のキュー秒数も復元しますか？\n\n` +
              `OK = 保存時の秒数を使う\n` +
              `キャンセル = 現在の曲の長さに合わせて等間隔で配り直す`
          )
        : false;
      if (
        !confirm(
          `現在のキューと形（フォーメーション）を「${item.name}」で置き換えます。\n\n` +
            `※ 元に戻したい場合は「戻る（Undo）」ボタンが使えます。\n\n` +
            `続行しますか？`
        )
      ) {
        return;
      }
      const expanded = expandFlowToProject(item, {
        replaceTiming,
        totalDurationSec:
          audioDurationSec > 0 ? audioDurationSec : null,
        minCueLengthSec: 0.8,
      });
      setProject((prev) => {
        let next: ChoreographyProjectJson = {
          ...prev,
          formations: expanded.formations,
          cues: expanded.cues,
          activeFormationId: expanded.activeFormationId,
        };
        /** memento 無し（旧フロー）のときは名簿を残さず、下で印から名簿を組み立てる */
        if (!expanded.memento) {
          next = { ...next, crews: [] };
        }
        if (expanded.stageSettings) {
          next = applyFlowStageSettingsToProject(next, expanded.stageSettings);
        }
        if (expanded.memento) {
          const m = expanded.memento;
          const embedKey =
            typeof m.flowEmbeddedAudioKey === "string" && m.flowEmbeddedAudioKey.length > 0
              ? m.flowEmbeddedAudioKey
              : null;
          next = {
            ...next,
            crews: m.crews,
            savedSpotLayouts: m.savedSpotLayouts,
            ...(m.rosterStripSortMode != null
              ? { rosterStripSortMode: m.rosterStripSortMode }
              : {}),
            ...(m.rosterHidesTimeline !== undefined
              ? { rosterHidesTimeline: m.rosterHidesTimeline }
              : {}),
            ...(m.rosterStripCollapsed !== undefined
              ? { rosterStripCollapsed: m.rosterStripCollapsed }
              : {}),
            pieceDancerCount: m.pieceDancerCount,
            ...(m.dancerLabelPosition === "inside" || m.dancerLabelPosition === "below"
              ? { dancerLabelPosition: m.dancerLabelPosition }
              : {}),
            ...(typeof m.dancerMarkerDiameterPx === "number" &&
            Number.isFinite(m.dancerMarkerDiameterPx)
              ? { dancerMarkerDiameterPx: m.dancerMarkerDiameterPx }
              : {}),
            ...(embedKey
              ? {
                  audioAssetId: null,
                  flowLocalAudioKey: embedKey,
                }
              : {
                  /**
                   * memento の `audioAssetId: null` は「保存時にサーバ音源が無かった」ことが多く、
                   * ここで上書きすると既に読み込んでいるサーバ Blob を revoke しただけで `<audio>` が死 URLのままになり再生不能になる。
                   * 数値が入っているときだけフロー側の id を採用する。
                   */
                  audioAssetId:
                    typeof m.audioAssetId === "number" && Number.isFinite(m.audioAssetId)
                      ? m.audioAssetId
                      : prev.audioAssetId,
                  flowLocalAudioKey: null,
                }),
            playbackRate: m.playbackRate,
            trimStartSec: m.trimStartSec,
            trimEndSec: m.trimEndSec,
            ...(m.waveformAmplitudeScale != null &&
            Number.isFinite(m.waveformAmplitudeScale)
              ? { waveformAmplitudeScale: m.waveformAmplitudeScale }
              : {}),
          };
        }
        return ensureCrewsFromFormationsIfEmpty(next);
      });
      const restoreDur =
        expanded.memento?.audioDurationSec != null &&
        expanded.memento.audioDurationSec > 0
          ? expanded.memento.audioDurationSec
          : audioDurationSec > 0
            ? audioDurationSec
            : undefined;
      const peaks = expanded.memento?.wavePeaks;
      if (peaks?.length) {
        /** setProject 後にコミットさせ、音源 effect と競合しにくくする */
        queueMicrotask(() => {
          onRestoreWaveform?.(peaks, restoreDur);
        });
      }
      setFeedback({
        kind: "info",
        text: `「${item.name}」を読み込みました（キュー ${expanded.cues.length}${
          expanded.stageSettings ? "・ステージ寸法" : ""
        }${expanded.memento ? "・名簿・立ち位置リスト・音源設定" : ""}）。`,
      });
      onClose();
    },
    [audioDurationSec, setProject, onClose, onRestoreWaveform]
  );

  const doExportJson = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const text = await exportFlowLibraryJsonAsync();
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `choreocore-flows-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setFeedback({
        kind: "info",
        text: "JSON をダウンロードしました（同梱したローカル音源が含まれる場合があります）。",
      });
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "エクスポートに失敗しました。",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      void f.text().then(async (text) => {
        setBusy(true);
        setFeedback(null);
        try {
          const r = await importFlowLibraryJsonAsync(text);
          if (r.message) {
            setFeedback({ kind: "error", text: r.message });
            return;
          }
          setFeedback({
            kind: "info",
            text: `取り込み完了：追加 ${r.added}・更新 ${r.updated}・スキップ ${r.skipped}${
              text.includes('"flowEmbeddedAudioBase64"')
                ? "（同梱音源をこのブラウザに復元しました）"
                : ""
            }。`,
          });
          refresh();
        } catch (e) {
          setFeedback({
            kind: "error",
            text: e instanceof Error ? e.message : "取り込みに失敗しました。",
          });
        } finally {
          setBusy(false);
        }
      });
    },
    [refresh]
  );

  if (!open) return null;

  const canSave = cuesCount > 0 && formCount > 0;

  return (
    <EditorSideSheet
      open
      zIndex={70}
      width="min(640px, 54vw)"
      blockDismiss={busy}
      onClose={onClose}
      ariaLabelledBy="flow-lib-title"
    >
      <div
        style={{
          padding: "16px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3
            id="flow-lib-title"
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "#f8fafc",
            }}
          >
            立ち位置フローライブラリ
          </h3>
          <button
            type="button"
            disabled={busy}
            aria-label="閉じる"
            onClick={onClose}
            style={{
              ...btnSecondary,
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px 12px",
            }}
          >
            ×
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "#94a3b8",
            lineHeight: 1.55,
          }}
        >
          キュー順に並んだ「立ち位置の流れ」を名前付きで端末に保存し、別の曲やプロジェクトでも呼び出せます。保存時のステージ寸法・場ミリ・客席向き・変形舞台も一緒に記録され、呼び出し時に現在の設定より優先して復元されます（以前に保存したフローにその情報が無い場合は、キューと形だけが置き換わります）。
        </p>

        <section style={card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <h4 style={sectionTitle}>現在のフローを保存</h4>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              キュー {fmtCount(cuesCount)} ／ 形 {fmtCount(formCount)} ／ 人数 {dancerCount}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="このフローの名前（例：A サビ崩し ver.2）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              style={{ ...inputBase, flex: 1 }}
              disabled={busy || !canSave}
            />
            <button
              type="button"
              onClick={doSave}
              disabled={busy || !canSave || !name.trim()}
              style={{
                ...btnSecondary,
                borderColor: "#14532d",
                color: "#bbf7d0",
                fontWeight: 600,
              }}
            >
              {busy ? "保存中…" : "新規保存"}
            </button>
          </div>
          {!canSave ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "11px",
                color: "#fbbf24",
              }}
            >
              キューが 1 つもありません。タイムラインでキューを作成してから保存してください。
            </p>
          ) : null}
        </section>

        <section
          style={{
            ...card,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h4 style={sectionTitle}>
              保存済みフロー（{fmtCount(items.length)} 件）
            </h4>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "4px 10px", fontSize: "11px" }}
                onClick={doExportJson}
                disabled={items.length === 0}
                title="保存済みフローを JSON にバックアップ"
              >
                書き出し
              </button>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "4px 10px", fontSize: "11px" }}
                onClick={() => fileInputRef.current?.click()}
                title="JSON バックアップから取り込み"
              >
                取り込み
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={onPickFile}
              />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: "120px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              paddingRight: "2px",
            }}
          >
            {items.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 12px",
                  color: "#64748b",
                  fontSize: "12px",
                  border: "1px dashed #1f2937",
                  borderRadius: "8px",
                }}
              >
                まだ保存されたフローはありません。
                <br />
                上の入力欄から名前をつけて保存してみましょう。
              </div>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    background: "#020617",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: "#f8fafc",
                          fontSize: "13px",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={it.name}
                      >
                        {it.name}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "11px",
                          marginTop: "2px",
                        }}
                      >
                        キュー {fmtCount(it.cueCount)} ／ 形 {fmtCount(it.formations.length)} ／ 人数 {it.dancerCount}
                        {it.hasTiming ? (
                          <span style={{ color: "#22d3ee", marginLeft: "8px" }}>
                            ⏱ 秒数あり
                          </span>
                        ) : null}
                        <span style={{ marginLeft: "8px" }}>
                          更新: {fmtDate(it.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => doApply(it)}
                      disabled={busy}
                      style={{
                        ...btnSecondary,
                        borderColor: "#6366f1",
                        color: "#c7d2fe",
                        fontWeight: 600,
                        padding: "6px 12px",
                      }}
                    >
                      読み込み
                    </button>
                  </div>
                  <FlowMiniRow item={it} />
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: "11px",
                      }}
                      disabled={busy || !canSave}
                      onClick={() => doOverwrite(it.id, it.name)}
                      title="現在のステージ内容でこのフローを上書き"
                    >
                      ⤴ 上書き保存
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: "11px",
                      }}
                      onClick={() => doRename(it.id, it.name)}
                    >
                      ✎ 名前変更
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: "11px",
                        borderColor: "#7f1d1d",
                        color: "#fecaca",
                      }}
                      onClick={() => doDelete(it.id, it.name)}
                    >
                      ✕ 削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {feedback ? (
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: feedback.kind === "error" ? "#fca5a5" : "#86efac",
            }}
          >
            {feedback.text}
          </p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={busy}
            style={btnSecondary}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </EditorSideSheet>
  );
}

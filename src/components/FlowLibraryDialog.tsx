import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import type { ChoreographyProjectJson } from "../types/choreography";
import { generateId } from "../lib/generateId";
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
import { projectApi } from "../api/client";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { copyTextToClipboard, projectShareLinks } from "../lib/shareProjectLinks";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { EditorSideSheet } from "./EditorSideSheet";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  open: boolean;
  onClose: () => void;
  /** クラウド保存済みの作品 ID。あるとき「保存済みフロー」欄に共同編集 / 閲覧の URL リストを出す。 */
  serverId?: number | null;
  /** Supabase 時の閲覧用 share_token。いま開いている作品と行の linked ID が一致するときの短絡用。 */
  serverShareToken?: string | null;
  /**
   * ログイン済みのとき渡す。フローの「新規保存」「上書き保存」の直前に呼び、いまの編集内容をクラウドに upsert する。
   * 返した `id` がフローの `linkedServerProjectId` に記録される。
   */
  syncProjectToCloud?: () => Promise<{ id: number; share_token?: string | null }>;
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
   * クラウド音源のみのときは呼び出し元で null を返してよい（memento の `audioAssetId` / `audioSupabasePath` で足りる）
   */
  getAudioBlobForFlowLibrary?: () => Promise<Blob | null>;
  /**
   * フロー一覧からクラウド保存確認を開く（ログイン済み編集時のみ）。
   */
  onOpenCloudSave?: () => void;
  /** 保存処理中はフロー内のクラウドボタンを無効化 */
  cloudSaveDisabled?: boolean;
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

/** フロー行の「共同編集 / 閲覧」に使うクラウド作品 ID（無ければ共有不可） */
function resolveFlowShareProjectId(
  it: FlowLibraryItem,
  serverId: number | null
): number | null {
  if (
    typeof it.linkedServerProjectId === "number" &&
    Number.isFinite(it.linkedServerProjectId) &&
    it.linkedServerProjectId > 0
  ) {
    return it.linkedServerProjectId;
  }
  if (serverId != null && serverId > 0) return serverId;
  return null;
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
  serverId = null,
  serverShareToken = null,
  syncProjectToCloud,
  onOpenCloudSave,
  cloudSaveDisabled = false,
}: Props) {
  const { t } = useI18n();
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
      if (project.audioAssetId == null &&
        (project.audioSupabasePath == null || String(project.audioSupabasePath).trim() === "") &&
        getAudioBlobForFlowLibrary) {
        const b = await getAudioBlobForFlowLibrary();
        if (b && b.size > 0) {
          const k = generateId();
          await putFlowLibraryAudio(k, b);
          flowEmbeddedAudioKey = k;
        }
      }
      let linkId: number | null =
        serverId != null && serverId > 0 ? Math.floor(serverId) : null;
      if (syncProjectToCloud) {
        const cloud = await syncProjectToCloud();
        linkId = cloud.id;
      }
      const r = saveFlowFromProject(trimmed, project, {
        includeTiming: true,
        wavePeaks: getWavePeaks?.() ?? null,
        audioDurationSec: audioDurationSec > 0 ? audioDurationSec : null,
        flowEmbeddedAudioKey: flowEmbeddedAudioKey ?? null,
        linkServerId: linkId,
      });
      if (!r.ok) {
        if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
        setFeedback({ kind: "error", text: r.message });
        return;
      }
      setFeedback({
        kind: "info",
        text:
          `「${r.item.name}」を保存しました（キュー ${r.item.cueCount} / 形 ${r.item.formations.length}）。` +
          (syncProjectToCloud ? " いまの作品もクラウドに保存しました。" : ""),
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
  }, [
    name,
    project,
    refresh,
    getWavePeaks,
    getAudioBlobForFlowLibrary,
    audioDurationSec,
    serverId,
    syncProjectToCloud,
  ]);

  const doOverwrite = useCallback(
    async (id: string, label: string) => {
      if (!confirm(`「${label}」を現在のステージ内容で上書きします。よろしいですか？`)) return;
      setBusy(true);
      let flowEmbeddedAudioKey: string | null = null;
      try {
        if (project.audioAssetId == null &&
        (project.audioSupabasePath == null || String(project.audioSupabasePath).trim() === "") &&
        getAudioBlobForFlowLibrary) {
          const b = await getAudioBlobForFlowLibrary();
          if (b && b.size > 0) {
            const k = generateId();
            await putFlowLibraryAudio(k, b);
            flowEmbeddedAudioKey = k;
          }
        }
        let linkId: number | null =
          serverId != null && serverId > 0 ? Math.floor(serverId) : null;
        if (syncProjectToCloud) {
          const cloud = await syncProjectToCloud();
          linkId = cloud.id;
        }
        const r = overwriteFlowFromProject(id, project, {
          includeTiming: true,
          wavePeaks: getWavePeaks?.() ?? null,
          audioDurationSec: audioDurationSec > 0 ? audioDurationSec : null,
          flowEmbeddedAudioKey: flowEmbeddedAudioKey ?? null,
          linkServerId: linkId,
        });
        if (!r.ok) {
          if (flowEmbeddedAudioKey) void deleteFlowLibraryAudio(flowEmbeddedAudioKey);
          setFeedback({ kind: "error", text: r.message });
          return;
        }
        setFeedback({
          kind: "info",
          text:
            `「${r.item.name}」を上書きしました。` +
            (syncProjectToCloud ? " いまの作品もクラウドに保存しました。" : ""),
        });
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
    [project, refresh, getWavePeaks, getAudioBlobForFlowLibrary, audioDurationSec, serverId, syncProjectToCloud]
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

  const copyFlowItemShare = useCallback(
    async (it: FlowLibraryItem, kind: "collab" | "view") => {
      const pid = resolveFlowShareProjectId(it, serverId);
      if (pid == null) {
        setFeedback({
          kind: "error",
          text:
            "先に作品をクラウドに保存してください。このフロー行で共有するには、保存または上書き保存で紐づくと安心です。",
        });
        return;
      }

      let viewToken: string | null | undefined;
      if (kind === "view" && isSupabaseBackend()) {
        const cached =
          pid === serverId && serverShareToken && String(serverShareToken).trim() !== ""
            ? String(serverShareToken).trim()
            : null;
        if (cached) {
          viewToken = cached;
        } else {
          try {
            const row = await projectApi.get(pid);
            const t = row.share_token != null ? String(row.share_token).trim() : "";
            viewToken = t !== "" ? t : null;
          } catch (e) {
            setFeedback({
              kind: "error",
              text: e instanceof Error ? e.message : "閲覧 URL の取得に失敗しました。",
            });
            return;
          }
          if (!viewToken) {
            setFeedback({
              kind: "error",
              text: "閲覧用トークンがありません。該当作品を一度上書き保存してください。",
            });
            return;
          }
        }
      }

      const u = projectShareLinks(pid, viewToken)[kind];
      const ok = await copyTextToClipboard(u);
      if (ok) {
        setFeedback({
          kind: "info",
          text:
            kind === "collab"
              ? `「${it.name}」用の共同編集 URL をコピーしました。`
              : `「${it.name}」用の閲覧 URL をコピーしました。`,
        });
      } else {
        setFeedback({ kind: "error", text: "クリップボードへのコピーに失敗しました。" });
      }
    },
    [serverId, serverShareToken]
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
                  audioSupabasePath: null,
                  flowLocalAudioKey: embedKey,
                }
              : (() => {
                  const sup =
                    typeof m.audioSupabasePath === "string" && m.audioSupabasePath.trim().length > 0
                      ? m.audioSupabasePath.trim()
                      : null;
                  if (sup) {
                    return {
                      audioSupabasePath: sup,
                      audioAssetId: null,
                      flowLocalAudioKey: null,
                    };
                  }
                  const numericAid =
                    typeof m.audioAssetId === "number" && Number.isFinite(m.audioAssetId)
                      ? m.audioAssetId
                      : null;
                  if (numericAid != null) {
                    return {
                      audioAssetId: numericAid,
                      audioSupabasePath: null,
                      flowLocalAudioKey: null,
                    };
                  }
                  /**
                   * memento の `audioAssetId: null` は「保存時にサーバ音源が無かった」ことが多く、
                   * ここで上書きすると既に読み込んでいるサーバ Blob を revoke しただけで `<audio>` が死 URLのままになり再生不能になる。
                   * 数値が入っているときだけフロー側の id を採用する。Supabase パスも同様に、明示されているときだけ採用する。
                   */
                  return {
                    audioAssetId: prev.audioAssetId,
                    audioSupabasePath: prev.audioSupabasePath ?? null,
                    flowLocalAudioKey: null,
                  };
                })()),
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
        {feedback ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              margin: "0 0 4px",
              padding: "10px 12px",
              borderRadius: "8px",
              background:
                feedback.kind === "error"
                  ? "rgba(127, 29, 29, 0.4)"
                  : "rgba(22, 101, 52, 0.35)",
              border:
                feedback.kind === "error"
                  ? "1px solid rgba(248, 113, 113, 0.45)"
                  : "1px solid rgba(74, 222, 128, 0.35)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: 1.45,
                color: feedback.kind === "error" ? "#fecaca" : "#bbf7d0",
                fontWeight: 500,
              }}
            >
              {feedback.text}
            </p>
          </div>
        ) : null}
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <Link
            to="/editor/new"
            onClick={onClose}
            style={{
              ...btnAccent,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 700,
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          >
            新規作成
          </Link>
          <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5, flex: "1 1 220px" }}>
            まっさらな作品から 1 から編集を始めます。いまの内容を残す場合は、先にクラウド保存やフロー保存をしてください。
          </span>
        </div>

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
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            各フロー行の「共同編集共有」「閲覧共有」で URL をコピーします。
            <strong style={{ color: "#cbd5e1" }}>ログイン中</strong>
            は「新規保存」「上書き保存」でいまの作品もクラウドに保存され、その作品 ID がフローに紐づきます。
            未ログインのときは、先にツールバーからクラウド保存して作品 ID を付けてください。
          </p>
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
              items.map((it) => {
                const sharePid = resolveFlowShareProjectId(it, serverId);
                const shareDisabledReason =
                  sharePid == null
                    ? "クラウドに保存した作品 ID がありません。いまの作品をクラウド保存するか、このフローを上書き保存して紐づけてください。"
                    : "";
                return (
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
                      gap: "5px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "10px",
                      }}
                      disabled={busy || !canSave}
                      onClick={() => doOverwrite(it.id, it.name)}
                      title="現在のステージ内容でこのフローを上書き"
                    >
                      上書き保存
                    </button>
                    {onOpenCloudSave ? (
                      <button
                        type="button"
                        style={{
                          ...btnAccent,
                          padding: "4px 8px",
                          fontSize: "10px",
                        }}
                        disabled={busy || cloudSaveDisabled}
                        title={
                          serverId != null && serverId > 0
                            ? t("editor.saveTitleOverwrite")
                            : t("editor.saveTitleNew")
                        }
                        onClick={() => onOpenCloudSave()}
                      >
                        {t("editor.cloudSaveFlowButton")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "10px",
                      }}
                      onClick={() => doRename(it.id, it.name)}
                    >
                      名前変更
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "10px",
                        borderColor: "rgba(22, 163, 74, 0.55)",
                        color: "#bbf7d0",
                      }}
                      disabled={busy || sharePid == null}
                      onClick={() => void copyFlowItemShare(it, "collab")}
                      title={
                        sharePid == null
                          ? shareDisabledReason
                          : "振り付けし・チーム用の共同編集 URL をコピー"
                      }
                    >
                      共同編集共有
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "10px",
                        borderColor: "rgba(14, 165, 233, 0.5)",
                        color: "#bae6fd",
                      }}
                      disabled={busy || sharePid == null}
                      onClick={() => void copyFlowItemShare(it, "view")}
                      title={
                        sharePid == null
                          ? shareDisabledReason
                          : "生徒用の閲覧だけ URL をコピー"
                      }
                    >
                      閲覧共有
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "10px",
                        borderColor: "#7f1d1d",
                        color: "#fecaca",
                      }}
                      onClick={() => doDelete(it.id, it.name)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </section>

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

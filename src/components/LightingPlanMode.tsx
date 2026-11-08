import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { ChoreographyProjectJson, Formation } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import {
  buildLightingPlanDocument,
  drawFormationSketch,
  formatLightingPlanPlayhead,
  formationSketchDancers,
  lightingPlanCueIdAtTime,
  omitCueFromLightingPlan,
  parseLightingPlanClock,
  restoreOmittedLightingPlanCues,
  setLightingPlanCueTime,
  withCuePlanText,
  withLightingPlan,
} from "../lib/lightingPlan";
import { formatPdfClock } from "../lib/choreographyPdfPages";
import { downloadLightingPlanPdf } from "../lib/lightingPlanPdf";
import {
  seekPlaybackClampedAndSyncStore,
  togglePlaybackRespectingTrimStart,
} from "../lib/playbackTransport";
import { useLightingPlanUiStore } from "../store/lightingPlanUiStore";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import styles from "./LightingPlanMode.module.css";

type Props = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  readOnly?: boolean;
};

function PlanTimeEditor({
  number,
  cueId,
  startSec,
  endSec,
  disabled,
  onCommit,
  onRemove,
  readPlayhead,
}: {
  number: number;
  cueId: string;
  startSec: number;
  endSec: number;
  disabled: boolean;
  onCommit: (cueId: string, startSec: number, endSec: number) => void;
  onRemove: (cueId: string) => void;
  /** 再生中の秒。時間欄へ写す */
  readPlayhead: () => number;
}) {
  const [startText, setStartText] = useState(formatPdfClock(startSec));
  const [endText, setEndText] = useState(formatPdfClock(endSec));

  useEffect(() => {
    setStartText(formatPdfClock(startSec));
    setEndText(formatPdfClock(endSec));
  }, [cueId, startSec, endSec]);

  const commit = () => {
    const start = parseLightingPlanClock(startText);
    const end = parseLightingPlanClock(endText);
    if (start == null || end == null || end <= start) {
      setStartText(formatPdfClock(startSec));
      setEndText(formatPdfClock(endSec));
      return;
    }
    onCommit(cueId, start, end);
  };

  const stamp = (which: "start" | "end") => {
    const text = formatPdfClock(readPlayhead());
    const nextStart = which === "start" ? text : startText;
    const nextEnd = which === "end" ? text : endText;
    if (which === "start") setStartText(text);
    else setEndText(text);
    const start = parseLightingPlanClock(nextStart);
    const end = parseLightingPlanClock(nextEnd);
    if (start == null || end == null || end <= start) return;
    onCommit(cueId, start, end);
  };

  return (
    <div className={styles.timeFields}>
      <div className={styles.timeRow}>
        {disabled ? null : (
          <button
            type="button"
            className={styles.stampNow}
            aria-label={`キュー ${number} の開始を今の秒にする`}
            title="再生位置を開始に入れる"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stamp("start")}
          >
            今
          </button>
        )}
        <input
          className={styles.timeInput}
          aria-label={`キュー ${number} の開始`}
          value={startText}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => setStartText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span>~</span>
        <input
          className={styles.timeInput}
          aria-label={`キュー ${number} の終了`}
          value={endText}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => setEndText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {disabled ? null : (
          <button
            type="button"
            className={styles.stampNow}
            aria-label={`キュー ${number} の終了を今の秒にする`}
            title="再生位置を終了に入れる"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stamp("end")}
          >
            今
          </button>
        )}
      </div>
      {disabled ? null : (
        <button
          type="button"
          className={styles.removeRow}
          aria-label={`キュー ${number} を照明プランから外す`}
          title="照明プランから外します。立ち位置のキューは残ります"
          onClick={() => onRemove(cueId)}
        >
          削除
        </button>
      )}
    </div>
  );
}

function FormationSketch({ formation }: { formation: Formation | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dancers = useMemo(
    () =>
      (formation?.dancers ?? []).map((dancer) => ({
        id: dancer.id,
        xPct: dancer.xPct,
        yPct: dancer.yPct,
        colorIndex: dancer.colorIndex,
        genderLabel: dancer.genderLabel,
        colorOverridesGender: dancer.colorOverridesGender,
      })),
    [formation]
  );
  const signature = dancers
    .map((d) => `${d.id}:${d.xPct}:${d.yPct}:${d.colorIndex}:${d.genderLabel ?? ""}`)
    .join("|");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !formation) return;
    const width = 168;
    const height = 96;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const projectLike = {
      formations: [formation],
    } as ChoreographyProjectJson;
    drawFormationSketch(
      ctx,
      { x: 0, y: 0, w: width, h: height },
      formationSketchDancers(projectLike, formation.id)
    );
  }, [formation, signature]);

  return <canvas ref={ref} className={styles.sketch} aria-hidden />;
}

function LightingPlanTransport({
  trimStartSec,
  trimEndSec,
}: {
  trimStartSec: number;
  trimEndSec: number | null;
}) {
  const currentTime = usePlaybackUiStore((s) => s.currentTimeSec);
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const duration = usePlaybackUiStore((s) => s.durationSec);
  const [hasAudio, setHasAudio] = useState(
    () => playbackEngine.getMediaSourceUrl().length > 0
  );

  useEffect(() => {
    const sync = () => setHasAudio(playbackEngine.getMediaSourceUrl().length > 0);
    sync();
    return playbackEngine.onMetaChange(sync);
  }, []);

  const clock = formatLightingPlanPlayhead(currentTime);
  const span = duration > 0 ? duration : playbackEngine.getDuration();

  return (
    <div className={styles.transport}>
      <button
        type="button"
        className={styles.transportPlay}
        disabled={!hasAudio}
        aria-label={isPlaying ? "一時停止" : "再生"}
        title={hasAudio ? "スペースキーでも再生・停止" : "音源を読み込んでから再生できます"}
        onClick={() => togglePlaybackRespectingTrimStart(trimStartSec)}
      >
        {isPlaying ? "一時停止" : "再生"}
      </button>
      <span className={styles.transportClock} aria-label={`再生位置 ${clock}`}>
        {clock}
      </span>
      <span className={styles.transportMeta}>/ {formatPdfClock(span)}</span>
      <input
        className={styles.transportRange}
        type="range"
        min={0}
        max={span > 0 ? span : 0}
        step={0.1}
        value={span > 0 ? Math.min(currentTime, span) : 0}
        disabled={!hasAudio || span <= 0}
        aria-label="再生位置"
        onChange={(event) => {
          const t = Number(event.target.value);
          if (!Number.isFinite(t)) return;
          seekPlaybackClampedAndSyncStore({
            t,
            durationSec: span,
            trimStartSec,
            trimEndSec,
          });
        }}
      />
      <span className={styles.transportHint}>
        {hasAudio ? "時間の「今」でこの秒を入れられます" : "音源がありません"}
      </span>
    </div>
  );
}

export function LightingPlanMode({ project, setProject, readOnly = false }: Props) {
  const open = useLightingPlanUiStore((s) => s.open);
  const closeSheet = useLightingPlanUiStore((s) => s.closeSheet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = useMemo(() => buildLightingPlanDocument(project), [project]);
  const plan = project.lightingPlan;

  const trimStartSec = project.trimStartSec ?? 0;
  const trimEndSec = project.trimEndSec ?? null;

  const readPlayhead = useCallback(() => {
    if (playbackEngine.getMediaSourceUrl()) return playbackEngine.getCurrentTime();
    return usePlaybackUiStore.getState().currentTimeSec;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSheet();
        return;
      }
      if (event.key !== " " && event.code !== "Space") return;
      const el = event.target instanceof HTMLElement ? event.target : null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        el?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      togglePlaybackRespectingTrimStart(trimStartSec);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSheet, trimStartSec]);

  const liveCueId = usePlaybackUiStore((s) =>
    lightingPlanCueIdAtTime(doc.rows, s.currentTimeSec)
  );

  if (!open) return null;

  const lock = readOnly || busy;

  const patchPlan = (patch: Parameters<typeof withLightingPlan>[1]) => {
    if (readOnly) return;
    setProject((current) => withLightingPlan(current, patch));
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadLightingPlanPdf(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF を作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="lighting-plan-title">
      <div className={styles.bar}>
        <h2 id="lighting-plan-title" className={styles.title}>
          照明プラン
        </h2>
        <p className={styles.lead}>
          発表会の照明キュー表です。時間の変更と行の削除は、この表だけに残ります。立ち位置のキューは変わりません。
        </p>
        <div className={styles.barActions}>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void download()}>
            {busy ? "PDF を作成中…" : "PDF をダウンロード"}
          </button>
          <button type="button" className={styles.secondary} onClick={closeSheet}>
            閉じる
          </button>
        </div>
      </div>
      <LightingPlanTransport trimStartSec={trimStartSec} trimEndSec={trimEndSec} />
      <div className={styles.scroll}>
        <div className={styles.paper}>
          <div className={styles.topRow}>
            <label className={styles.inlineLabel}>
              演目順
              <input
                className={styles.box}
                aria-label="演目順"
                value={plan?.programOrder ?? ""}
                disabled={lock}
                onChange={(e) => patchPlan({ programOrder: e.target.value })}
              />
              －
              <input
                className={styles.box}
                aria-label="演目順の枝番"
                value={plan?.programSub ?? ""}
                disabled={lock}
                onChange={(e) => patchPlan({ programSub: e.target.value })}
              />
            </label>
            <label className={styles.inlineLabel}>
              板付
              <input
                className={styles.box}
                aria-label="板付"
                value={plan?.presetMark ?? ""}
                disabled={lock}
                onChange={(e) => patchPlan({ presetMark: e.target.value })}
              />
            </label>
            <label className={styles.inlineLabel}>
              ピンスポ
              <select
                className={styles.select}
                value={plan?.pinSpot ?? ""}
                disabled={lock}
                onChange={(e) => {
                  const value = e.target.value;
                  patchPlan({
                    pinSpot: value === "あり" || value === "なし" ? value : undefined,
                  });
                }}
              >
                <option value="">未記入</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
              </select>
            </label>
          </div>

          <div className={styles.heading}>
            <input
              className={styles.headingInput}
              aria-label="発表会名"
              placeholder="第19回 S.O.P発表会"
              value={plan?.eventTitle ?? ""}
              disabled={lock}
              onChange={(e) => patchPlan({ eventTitle: e.target.value })}
            />
            {(plan?.eventTitle ?? "").trim().endsWith("照明プラン") ? null : (
              <span>照明プラン</span>
            )}
          </div>

          <table className={styles.meta}>
            <tbody>
              <tr>
                <th>クラス名</th>
                <td>
                  <input
                    aria-label="クラス名"
                    value={plan?.className ?? ""}
                    disabled={lock}
                    placeholder="オープニング"
                    onChange={(e) => patchPlan({ className: e.target.value })}
                  />
                </td>
                <th>TIME</th>
                <td>{doc.timeLabel || "—"}</td>
                <th>人数</th>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label="人数"
                    value={project.pieceDancerCount ?? ""}
                    disabled={lock}
                    placeholder={doc.headcountLabel || "人数"}
                    onChange={(e) => {
                      if (readOnly) return;
                      const raw = e.target.value.trim();
                      setProject((current) => ({
                        ...current,
                        pieceDancerCount:
                          raw === ""
                            ? null
                            : Math.min(200, Math.max(1, Math.floor(Number(raw)) || 0)) || null,
                      }));
                    }}
                  />
                </td>
              </tr>
              <tr>
                <th>使用曲</th>
                <td>
                  <input
                    aria-label="使用曲"
                    value={plan?.songTitle ?? ""}
                    disabled={lock}
                    placeholder={project.pieceTitle || "曲名"}
                    onChange={(e) => patchPlan({ songTitle: e.target.value })}
                  />
                </td>
                <th>衣装</th>
                <td colSpan={3}>
                  <label className={styles.inlineLabel}>
                    下－
                    <input
                      aria-label="衣装の下"
                      value={plan?.costumeBottom ?? ""}
                      disabled={lock}
                      placeholder="ブルー"
                      onChange={(e) => patchPlan({ costumeBottom: e.target.value })}
                    />
                  </label>
                  <label className={styles.inlineLabel} style={{ marginLeft: 12 }}>
                    上－
                    <input
                      aria-label="衣装の上"
                      value={plan?.costumeTop ?? ""}
                      disabled={lock}
                      placeholder="白シャツ"
                      onChange={(e) => patchPlan({ costumeTop: e.target.value })}
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th>全体の雰囲気</th>
                <td colSpan={5}>
                  <input
                    aria-label="全体の雰囲気"
                    value={plan?.atmosphere ?? ""}
                    disabled={lock}
                    placeholder="かっこよくサビは明るく賑やかに"
                    onChange={(e) => patchPlan({ atmosphere: e.target.value })}
                  />
                </td>
              </tr>
              <tr>
                <th>ポイント</th>
                <td colSpan={5}>
                  <input
                    aria-label="ポイント"
                    value={plan?.points ?? ""}
                    disabled={lock}
                    placeholder="初めのSS、サス、ピンスポ"
                    onChange={(e) => patchPlan({ points: e.target.value })}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <table className={styles.cueTable} style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 52 }}>番号</th>
                <th style={{ width: 196 }}>時間</th>
                <th>フォーメーション</th>
                <th style={{ width: "34%" }}>照明 要望等</th>
              </tr>
            </thead>
            <tbody>
              {doc.rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className={styles.empty}>
                      タイムラインにキューを置くと、番号・時間・隊形がここに並びます。
                    </p>
                  </td>
                </tr>
              ) : (
                doc.rows.map((row) => {
                  const cue = project.cues.find((item) => item.id === row.cueId);
                  const formation = project.formations.find((item) => item.id === row.formationId);
                  return (
                    <tr
                      key={row.cueId}
                      className={row.cueId === liveCueId ? styles.rowLive : undefined}
                    >
                      <td className={styles.num}>{row.number}</td>
                      <td className={styles.time}>
                        <PlanTimeEditor
                          number={row.number}
                          cueId={row.cueId}
                          startSec={row.tStartSec}
                          endSec={row.tEndSec}
                          disabled={lock}
                          readPlayhead={readPlayhead}
                          onCommit={(cueId, startSec, endSec) =>
                            setProject((current) => {
                              const cue = current.cues.find((item) => item.id === cueId);
                              const next = setLightingPlanCueTime(
                                current,
                                cueId,
                                startSec,
                                endSec
                              );
                              if (cue && next.cues.some((item) => item === cue)) return next;
                              return current;
                            })
                          }
                          onRemove={(cueId) =>
                            setProject((current) => {
                              const before = current.cues;
                              const next = omitCueFromLightingPlan(current, cueId);
                              if (next.cues !== before) return current;
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        <div className={styles.formationCell}>
                          <FormationSketch formation={formation} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              className={styles.cellInput}
                              aria-label={`キュー ${row.number} の名前`}
                              placeholder="キュー名（サビ、選抜など）"
                              value={cue?.name ?? ""}
                              disabled={lock}
                              onChange={(e) =>
                                setProject((current) =>
                                  withCuePlanText(current, row.cueId, { name: e.target.value })
                                )
                              }
                            />
                            <textarea
                              className={styles.cellArea}
                              aria-label={`キュー ${row.number} の説明`}
                              placeholder="説明（隊形や動きのメモ）"
                              value={cue?.note ?? ""}
                              disabled={lock}
                              onChange={(e) =>
                                setProject((current) =>
                                  withCuePlanText(current, row.cueId, { note: e.target.value })
                                )
                              }
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <textarea
                          className={styles.cellArea}
                          aria-label={`キュー ${row.number} の照明要望`}
                          placeholder="赤系、サス、ピンスポ…"
                          value={cue?.lightingRequest ?? ""}
                          disabled={lock}
                          onChange={(e) =>
                            setProject((current) =>
                              withCuePlanText(current, row.cueId, {
                                lightingRequest: e.target.value,
                              })
                            )
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {(plan?.omittedCueIds?.length ?? 0) > 0 ? (
            <p className={styles.restoreRow}>
              <button
                type="button"
                className={styles.restoreButton}
                disabled={lock}
                onClick={() =>
                  setProject((current) => restoreOmittedLightingPlanCues(current))
                }
              >
                外した行を戻す
              </button>
              <span>立ち位置のキューは消えていません。</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

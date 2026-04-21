import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type {
  ChoreographyProjectJson,
  Crew,
  CrewMember,
  Cue,
  DancerSpot,
  RosterStripSortMode,
} from "../types/choreography";
import { defaultFormation } from "../lib/projectDefaults";
import { normalizeProject } from "../lib/normalizeProject";
import { btnPrimary, btnSecondary } from "./StageBoard";
import {
  PROJECT_EXPORT_FORMAT_OPTIONS,
  type ProjectExportFormatId,
  downloadProjectCsvForExcel,
  downloadProjectHtmlForGoogleDocs,
  downloadProjectJson,
  importProjectFromChoreogridCsv,
  openPrintablePdfReport,
} from "../lib/projectExportFormats";
import {
  buildCrewFromCsv,
  fetchCsvFromGoogleSheetsUrl,
  type RosterNameImportMode,
} from "../lib/crewCsvImport";
import {
  captureStageSnapshot,
  mergeStageSnapshotIntoProject,
} from "../lib/savedSpotStageSnapshot";

const FORMATION_NAME_MAX = 120;

/** StageBoard の DANCER_PALETTE と同じ（名簿の色チップ表示用） */
const MEMBER_COLOR_SWATCHES = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
] as const;

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  /** キューあり時、ステージを再生補間ではなく選択中フォーメーションの保存データで表示してドラッグ調整する */
  stageLayoutEditMode?: boolean;
  onStageLayoutEditModeChange?: (editing: boolean) => void;
  /** インスペクタで編集するフォーメーション id（選択中キューに合わせる） */
  formationEditTargetId?: string | null;
  /** フォーメーション切替時（キュー選択中はキュー側も更新） */
  onInspectorFormationSelect?: (formationId: string) => void;
  /** 選択中のキュー（メモ表示・ライブラリ適用先） */
  selectedCue?: Cue | null;
  /** §6 ライブラリカードのホバーでステージに一時プレビュー */
  onLibraryHoverPreview?: (dancers: DancerSpot[] | null) => void;
};

export function InspectorPanel({
  project,
  setProject,
  stageLayoutEditMode = false,
  onStageLayoutEditModeChange,
  formationEditTargetId = null,
  onInspectorFormationSelect,
  selectedCue = null,
  onLibraryHoverPreview,
}: Props) {
  const {
    formations,
    activeFormationId,
    audienceEdge,
    viewMode,
    crews,
    cues,
    savedSpotLayouts,
  } = project;

  const editFormationId =
    formationEditTargetId != null && formations.some((f) => f.id === formationEditTargetId)
      ? formationEditTargetId
      : activeFormationId;

  const activeFormation = formations.find((f) => f.id === editFormationId);

  const [exportFormat, setExportFormat] = useState<ProjectExportFormatId>("json");
  /** 「名簿から追加」プルダウン: `${crewId}|${memberId}` */
  const [addFromRosterPick, setAddFromRosterPick] = useState("");
  /** 名簿の CSV / Google スプレッドシート 取り込み UI 状態 */
  const [crewImportOpen, setCrewImportOpen] = useState(false);
  const [crewImportNameMode, setCrewImportNameMode] =
    useState<RosterNameImportMode>("full");
  const [crewImportName, setCrewImportName] = useState("");
  const [crewImportSheetUrl, setCrewImportSheetUrl] = useState("");
  const [crewImportBusy, setCrewImportBusy] = useState(false);
  const [crewImportError, setCrewImportError] = useState<string | null>(null);
  const [formationNameInlineEdit, setFormationNameInlineEdit] = useState(false);
  const formationNameSnapshotRef = useRef("");
  useEffect(() => {
    setFormationNameInlineEdit(false);
  }, [editFormationId]);

  const updateActiveFormation = (
    updater: (f: NonNullable<typeof activeFormation>) => NonNullable<typeof activeFormation>
  ) => {
    if (!activeFormation || viewMode === "view") return;
    setProject((p) => ({
      ...p,
      formations: p.formations.map((f) =>
        f.id === editFormationId ? updater(f) : f
      ),
    }));
  };

  const [libraryCountFilter, setLibraryCountFilter] = useState<number | "">("");

  const filteredSavedLayouts = useMemo(() => {
    if (libraryCountFilter === "" || !Number.isFinite(libraryCountFilter)) {
      return savedSpotLayouts;
    }
    const n = Math.floor(Number(libraryCountFilter));
    return savedSpotLayouts.filter((s) => s.savedAtCount === n || s.dancers.length === n);
  }, [savedSpotLayouts, libraryCountFilter]);

  const saveCurrentLayoutToLibrary = () => {
    if (!activeFormation || viewMode === "view") return;
    const name = window.prompt("ライブラリに保存する名前", `形 ${savedSpotLayouts.length + 1}`);
    if (name === null) return;
    const dancersCopy: DancerSpot[] = activeFormation.dancers.map((d) => ({ ...d }));
    setProject((p) => ({
      ...p,
      savedSpotLayouts: [
        ...p.savedSpotLayouts,
        {
          id: crypto.randomUUID(),
          name: name.trim().slice(0, 120) || "無題",
          savedAtCount: dancersCopy.length,
          dancers: dancersCopy,
          stageSnapshot: captureStageSnapshot(p),
        },
      ].slice(0, 80),
    }));
  };

  const applySavedLayoutToSelectedCue = (layout: (typeof savedSpotLayouts)[0]) => {
    if (viewMode === "view") return;
    if (!selectedCue) {
      window.alert("キューを選択してください（適用先のスナップショット）。");
      return;
    }
    const fid = selectedCue.formationId;
    setProject((p) => {
      let next: ChoreographyProjectJson = {
        ...p,
        formations: p.formations.map((f) =>
          f.id === fid
            ? {
                ...f,
                dancers: layout.dancers.map((d) => ({ ...d })),
                confirmedDancerCount: layout.dancers.length,
              }
            : f
        ),
      };
      if (layout.stageSnapshot) {
        next = mergeStageSnapshotIntoProject(next, layout.stageSnapshot);
      }
      return next;
    });
    onLibraryHoverPreview?.(null);
  };

  const setDancerNote = (dancerId: string, note: string) => {
    updateActiveFormation((f) => ({
      ...f,
      dancers: f.dancers.map((d) =>
        d.id === dancerId
          ? {
              ...d,
              note: note.trim() ? note.trim().slice(0, 2000) : undefined,
            }
          : d
      ),
    }));
  };

  const resolveLinkedMember = (d: DancerSpot): CrewMember | null => {
    if (!d.crewMemberId) return null;
    for (const c of crews) {
      const m = c.members.find((x) => x.id === d.crewMemberId);
      if (m) return m;
    }
    return null;
  };

  /** 身長・学年・スキルをステージ上のスポットと名簿メンバーの両方に反映（並び替えに使われる） */
  const patchDancerRosterMeta = (
    dancerId: string,
    patch: {
      heightCm?: number | undefined;
      gradeLabel?: string | undefined;
      skillRankLabel?: string | undefined;
      genderLabel?: string | undefined;
    }
  ) => {
    if (viewMode === "view") return;
    setProject((p) => {
      const f = p.formations.find((x) => x.id === editFormationId);
      if (!f) return p;
      const spot = f.dancers.find((x) => x.id === dancerId);
      if (!spot) return p;

      const gradeNorm =
        patch.gradeLabel !== undefined
          ? patch.gradeLabel.trim()
            ? patch.gradeLabel.trim().slice(0, 32)
            : undefined
          : undefined;
      const skillNorm =
        patch.skillRankLabel !== undefined
          ? patch.skillRankLabel.trim()
            ? patch.skillRankLabel.trim().slice(0, 24)
            : undefined
          : undefined;
      const genderNorm =
        patch.genderLabel !== undefined
          ? patch.genderLabel.trim()
            ? patch.genderLabel.trim().slice(0, 32)
            : undefined
          : undefined;

      let crewsNext = p.crews;
      if (spot.crewMemberId) {
        const mid = spot.crewMemberId;
        crewsNext = p.crews.map((c) => ({
          ...c,
          members: c.members.map((m) => {
            if (m.id !== mid) return m;
            let nm = { ...m };
            if ("heightCm" in patch) {
              nm = { ...nm, heightCm: patch.heightCm };
            }
            if ("gradeLabel" in patch) {
              nm = { ...nm, gradeLabel: gradeNorm };
            }
            if ("skillRankLabel" in patch) {
              nm = { ...nm, skillRankLabel: skillNorm };
            }
            if ("genderLabel" in patch) {
              nm = { ...nm, genderLabel: genderNorm };
            }
            return nm;
          }),
        }));
      }

      return {
        ...p,
        crews: crewsNext,
        formations: p.formations.map((fm) =>
          fm.id !== editFormationId
            ? fm
            : {
                ...fm,
                dancers: fm.dancers.map((d) => {
                  if (d.id !== dancerId) return d;
                  let nd = { ...d };
                  if ("heightCm" in patch) {
                    nd = { ...nd, heightCm: patch.heightCm };
                  }
                  if ("gradeLabel" in patch) {
                    nd = { ...nd, gradeLabel: gradeNorm };
                  }
                  if ("skillRankLabel" in patch) {
                    nd = { ...nd, skillRankLabel: skillNorm };
                  }
                  if ("genderLabel" in patch) {
                    nd = { ...nd, genderLabel: genderNorm };
                  }
                  return nd;
                }),
              }
        ),
      };
    });
  };

  const setDancerHeightCm = (dancerId: string, raw: string) => {
    const t = raw.trim();
    let heightCm: number | undefined;
    if (t === "") heightCm = undefined;
    else {
      const n = parseFloat(t.replace(/,/g, "."));
      if (!Number.isFinite(n) || n <= 0 || n >= 300) heightCm = undefined;
      else heightCm = Math.round(n * 10) / 10;
    }
    patchDancerRosterMeta(dancerId, { heightCm });
  };

  const setDancerGradeLabel = (dancerId: string, raw: string) => {
    patchDancerRosterMeta(dancerId, { gradeLabel: raw });
  };

  const setDancerSkillRankLabel = (dancerId: string, raw: string) => {
    patchDancerRosterMeta(dancerId, { skillRankLabel: raw });
  };

  const setDancerGenderLabel = (dancerId: string, raw: string) => {
    patchDancerRosterMeta(dancerId, { genderLabel: raw });
  };

  const addDancer = () => {
    updateActiveFormation((f) => {
      const n = f.dancers.length + 1;
      return {
        ...f,
        dancers: [
          ...f.dancers,
          {
            id: crypto.randomUUID(),
            label: String(n),
            xPct: 50,
            yPct: 40,
            colorIndex: n % 9,
          },
        ],
      };
    });
  };

  const rosterMembersNotOnStage = useMemo(() => {
    if (!activeFormation) return [];
    const onStage = new Set(
      activeFormation.dancers
        .map((d) => d.crewMemberId)
        .filter((id): id is string => Boolean(id))
    );
    const out: { crewId: string; crewName: string; member: CrewMember }[] = [];
    for (const crew of crews) {
      for (const m of crew.members) {
        if (!onStage.has(m.id)) {
          out.push({ crewId: crew.id, crewName: crew.name, member: m });
        }
      }
    }
    return out;
  }, [crews, activeFormation]);

  useEffect(() => {
    if (!addFromRosterPick) return;
    const ok = rosterMembersNotOnStage.some(
      ({ crewId, member }) => `${crewId}|${member.id}` === addFromRosterPick
    );
    if (!ok) setAddFromRosterPick("");
  }, [addFromRosterPick, rosterMembersNotOnStage]);

  const addDancerFromRosterPick = () => {
    if (!activeFormation || viewMode === "view" || !addFromRosterPick) return;
    const pipe = addFromRosterPick.indexOf("|");
    if (pipe < 1) return;
    const crewId = addFromRosterPick.slice(0, pipe);
    const memberId = addFromRosterPick.slice(pipe + 1);
    const crew = crews.find((c) => c.id === crewId);
    const m = crew?.members.find((x) => x.id === memberId);
    if (!m) return;
    if (activeFormation.dancers.some((d) => d.crewMemberId === m.id)) return;
    updateActiveFormation((f) => {
      const idx = f.dancers.length;
      return {
        ...f,
        dancers: [
          ...f.dancers,
          {
            id: crypto.randomUUID(),
            label: m.label.slice(0, 8),
            xPct: 50 + (idx % 5) * 5,
            yPct: 40 + Math.floor(idx / 5) * 10,
            colorIndex: m.colorIndex % 9,
            crewMemberId: m.id,
            ...(typeof m.heightCm === "number" ? { heightCm: m.heightCm } : {}),
            ...(m.gradeLabel?.trim()
              ? { gradeLabel: m.gradeLabel.trim().slice(0, 32) }
              : {}),
            ...(m.skillRankLabel?.trim()
              ? { skillRankLabel: m.skillRankLabel.trim().slice(0, 24) }
              : {}),
          },
        ],
      };
    });
    setAddFromRosterPick("");
  };

  const removeDancer = (id: string) => {
    updateActiveFormation((f) => ({
      ...f,
      dancers: f.dancers.filter((d) => d.id !== id),
    }));
  };

  const setDancerLabel = (id: string, label: string) => {
    if (!activeFormation || viewMode === "view") return;
    const value = label.slice(0, 8);
    const dancer = activeFormation.dancers.find((d) => d.id === id);
    const cmid = dancer?.crewMemberId;
    setProject((p) => {
      let crews = p.crews;
      if (cmid) {
        crews = p.crews.map((crew) => ({
          ...crew,
          members: crew.members.map((m) =>
            m.id === cmid ? { ...m, label: value } : m
          ),
        }));
      }
      /**
       * 名前の連動: 同じ人物（同じ id または同じ crewMemberId）を持つダンサーを
       * 全フォーメーション（＝全キュー）で同じ label に揃える。
       * これでキューを追加してから別のキューで名前を変えても、各キューの
       * 立ち位置に紐付く名前が常に同期する。
       */
      return {
        ...p,
        crews,
        formations: p.formations.map((f) => ({
          ...f,
          dancers: f.dancers.map((d) =>
            d.id === id || (cmid && d.crewMemberId === cmid)
              ? { ...d, label: value }
              : d
          ),
        })),
      };
    });
  };

  const newFormation = () => {
    const f = defaultFormation();
    f.name = `フォーメーション ${formations.length + 1}`;
    setProject((p) => ({
      ...p,
      formations: [...p.formations, f],
      activeFormationId: f.id,
    }));
  };

  const duplicateFormation = () => {
    if (!activeFormation) return;
    setProject((p) => {
      const copy = {
        ...activeFormation,
        id: crypto.randomUUID(),
        name: `${activeFormation.name} のコピー`,
        dancers: activeFormation.dancers.map((d) => ({
          ...d,
          id: crypto.randomUUID(),
          xPct: Math.min(98, d.xPct + 3),
          yPct: Math.min(98, d.yPct + 3),
        })),
      };
      return {
        ...p,
        formations: [...p.formations, copy],
        activeFormationId: copy.id,
      };
    });
  };

  const deleteFormation = () => {
    if (formations.length <= 1) return;
    setProject((p) => {
      const next = p.formations.filter((f) => f.id !== editFormationId);
      return {
        ...p,
        formations: next,
        activeFormationId: next[0].id,
      };
    });
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const raw = JSON.parse(String(r.result));
          const data = normalizeProject(raw);
          if (!data.formations?.length) {
            alert("形式が正しくありません（作品JSON）");
            return;
          }
          setProject(data);
        } catch {
          alert("JSON の読み込みに失敗しました");
        }
      };
      r.readAsText(f);
    };
    input.click();
  };

  const importCsv = () => {
    if (viewMode === "view") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const text = String(r.result);
          const merged = importProjectFromChoreogridCsv(text, project);
          setProject(normalizeProject(merged));
        } catch (e) {
          alert(e instanceof Error ? e.message : "CSV の読み込みに失敗しました");
        }
      };
      r.readAsText(f, "UTF-8");
    };
    input.click();
  };

  const exportPng = async () => {
    const node = document.getElementById("stage-export-root");
    if (!node) {
      alert("ステージ要素が見つかりません");
      return;
    }
    try {
      const url = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0f172a",
      });
      const a = document.createElement("a");
      a.href = url;
      const base = (project.pieceTitle || "stage").replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
      a.download = `${base || "stage"}.png`;
      a.click();
    } catch (e) {
      alert(e instanceof Error ? e.message : "PNG の書き出しに失敗しました");
    }
  };

  const runExport = async () => {
    switch (exportFormat) {
      case "json":
        downloadProjectJson(project);
        break;
      case "png":
        await exportPng();
        break;
      case "pdf_print":
        openPrintablePdfReport(project);
        break;
      case "csv_excel":
        downloadProjectCsvForExcel(project);
        break;
      case "html_gdocs":
        downloadProjectHtmlForGoogleDocs(project);
        break;
      default:
        break;
    }
  };

  const addCrew = () => {
    const crew: Crew = {
      id: crypto.randomUUID(),
      name: `メンバー ${crews.length + 1}`,
      members: [
        { id: crypto.randomUUID(), label: "1", colorIndex: 0 },
        { id: crypto.randomUUID(), label: "2", colorIndex: 1 },
      ],
    };
    setProject((p) => ({ ...p, crews: [...p.crews, crew] }));
  };

  const finalizeCrewImport = (csvText: string) => {
    const baseName =
      crewImportName.trim() || `名簿 ${crews.length + 1}`;
    let att = { excludedRows: 0, hadAttendanceColumn: false };
    const crew = buildCrewFromCsv(baseName, csvText, {
      nameMode: crewImportNameMode,
      onAttendanceFiltered: (info) => {
        att = info;
      },
    });
    if (crew.members.length === 0) {
      let msg =
        "名前らしき列が見つかりませんでした。1 列目に名前を入れるか、見出し行に「名前」「label」「name」などを入れてください。";
      if (att.hadAttendanceColumn) {
        msg +=
          " 出欠列はありましたが、参加（○・参加 など）と判定できる行がありませんでした。";
      }
      setCrewImportError(msg);
      return;
    }
    setProject((p) => ({
      ...p,
      crews: [...p.crews, crew],
      rosterStripCollapsed: false,
      rosterHidesTimeline: true,
    }));
    setCrewImportOpen(false);
    setCrewImportNameMode("full");
    setCrewImportName("");
    setCrewImportSheetUrl("");
    setCrewImportError(null);
  };

  const onPickCrewCsvFile = () => {
    if (viewMode === "view") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          finalizeCrewImport(String(r.result ?? ""));
        } catch (e) {
          setCrewImportError(
            e instanceof Error ? e.message : "CSV の読み込みに失敗しました"
          );
        }
      };
      r.onerror = () =>
        setCrewImportError("ファイルを読めませんでした");
      r.readAsText(f, "UTF-8");
    };
    input.click();
  };

  const onImportCrewFromGoogleSheets = async () => {
    if (viewMode === "view") return;
    const url = crewImportSheetUrl.trim();
    if (!url) {
      setCrewImportError("Google スプレッドシートの URL を貼り付けてください");
      return;
    }
    setCrewImportBusy(true);
    setCrewImportError(null);
    try {
      const text = await fetchCsvFromGoogleSheetsUrl(url);
      finalizeCrewImport(text);
    } catch (e) {
      setCrewImportError(
        e instanceof Error
          ? e.message
          : "スプレッドシートの取得に失敗しました"
      );
    } finally {
      setCrewImportBusy(false);
    }
  };

  const updateCrewName = (crewId: string, name: string) => {
    setProject((p) => ({
      ...p,
      crews: p.crews.map((c) => (c.id === crewId ? { ...c, name } : c)),
    }));
  };

  const addMemberToCrew = (crewId: string) => {
    setProject((p) => ({
      ...p,
      crews: p.crews.map((c) =>
        c.id === crewId
          ? {
              ...c,
              members: [
                ...c.members,
                {
                  id: crypto.randomUUID(),
                  label: String(c.members.length + 1),
                  colorIndex: c.members.length % 9,
                },
              ],
            }
          : c
      ),
    }));
  };

  const updateMemberLabel = (crewId: string, memberId: string, label: string) => {
    const value = label.slice(0, 8);
    setProject((p) => ({
      ...p,
      crews: p.crews.map((c) =>
        c.id !== crewId
          ? c
          : {
              ...c,
              members: c.members.map((m) =>
                m.id === memberId ? { ...m, label: value } : m
              ),
            }
      ),
      formations: p.formations.map((f) => ({
        ...f,
        dancers: f.dancers.map((d) =>
          d.crewMemberId === memberId ? { ...d, label: value } : d
        ),
      })),
    }));
  };

  const removeMemberFromCrew = (crewId: string, memberId: string) => {
    setProject((p) => ({
      ...p,
      crews: p.crews.map((c) =>
        c.id === crewId
          ? { ...c, members: c.members.filter((m) => m.id !== memberId) }
          : c
      ),
      formations: p.formations.map((f) => ({
        ...f,
        dancers: f.dancers.map((d) =>
          d.crewMemberId === memberId
            ? { ...d, crewMemberId: undefined }
            : d
        ),
      })),
    }));
  };

  const removeCrew = (crewId: string) => {
    setProject((p) => ({ ...p, crews: p.crews.filter((c) => c.id !== crewId) }));
  };

  const applyCrewToFormation = (crew: Crew) => {
    if (!activeFormation || viewMode === "view") return;
    /**
     * 名簿の反映:
     * 1. 既存ダンサーがあれば、その id と立ち位置を保ったまま順序通りに
     *    名簿の identity（label / colorIndex / crewMemberId）を上書きする。
     *    → 他キューと同じ id を共有しているので、別キューも自動的に同じ
     *      crewMemberId / 名前に揃えられる（下記 propagate）。
     * 2. 名簿の方が多い場合は、超過分のメンバーを新規ダンサーとして
     *    既定のグリッド位置に追加する（active formation のみ）。
     * 3. 他のフォーメーション（＝他キュー）でも、同じ id を持つダンサーは
     *    名前・色・名簿リンクを反映する。位置はそのキューの値を保つ。
     */
    const old = activeFormation.dancers;
    const dancers: DancerSpot[] = crew.members.map((m, i) => {
      const existing = old[i];
      if (existing) {
        return {
          ...existing,
          label: m.label,
          colorIndex: m.colorIndex,
          crewMemberId: m.id,
        };
      }
      return {
        id: crypto.randomUUID(),
        label: m.label,
        xPct: 18 + (i % 6) * 13,
        yPct: 28 + Math.floor(i / 6) * 18,
        colorIndex: m.colorIndex,
        crewMemberId: m.id,
      };
    });

    /** 他フォーメーションへ伝播するための id → identity マップ */
    const identityById = new Map<
      string,
      { label: string; colorIndex: number; crewMemberId: string }
    >();
    for (const d of dancers) {
      if (d.crewMemberId) {
        identityById.set(d.id, {
          label: d.label,
          colorIndex: d.colorIndex,
          crewMemberId: d.crewMemberId,
        });
      }
    }

    setProject((p) => ({
      ...p,
      formations: p.formations.map((f) => {
        if (f.id === editFormationId) {
          return { ...f, dancers };
        }
        return {
          ...f,
          dancers: f.dancers.map((d) => {
            const ident = identityById.get(d.id);
            return ident
              ? {
                  ...d,
                  label: ident.label,
                  colorIndex: ident.colorIndex,
                  crewMemberId: ident.crewMemberId,
                }
              : d;
          }),
        };
      }),
    }));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontSize: "13px",
        overflow: "auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>書き出し</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <select
            aria-label="書き出し形式"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ProjectExportFormatId)}
            style={{
              flex: "1 1 220px",
              minWidth: "0",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "12px",
            }}
          >
            {PROJECT_EXPORT_FORMAT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" style={btnPrimary} onClick={() => void runExport()}>
            書き出し
          </button>
        </div>
        {PROJECT_EXPORT_FORMAT_OPTIONS.find((o) => o.id === exportFormat)?.hint && (
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            {PROJECT_EXPORT_FORMAT_OPTIONS.find((o) => o.id === exportFormat)?.hint}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" style={btnSecondary} onClick={importJson}>
            JSON 読み込み
          </button>
          <button
            type="button"
            style={btnSecondary}
            disabled={viewMode === "view"}
            onClick={importCsv}
          >
            CSV 取り込み（§13）
          </button>
          <button
            type="button"
            style={btnSecondary}
            onClick={() =>
              setProject((p) => ({
                ...p,
                viewMode: p.viewMode === "edit" ? "view" : "edit",
              }))
            }
          >
            {viewMode === "edit" ? "閲覧モード" : "編集モード"}
          </button>
        </div>
      </div>

      <label style={{ color: "#94a3b8", fontSize: "11px" }}>
        客席の位置（画面に対して）
        <select
          value={audienceEdge}
          onChange={(e) =>
            setProject((p) => ({
              ...p,
              audienceEdge: e.target.value as ChoreographyProjectJson["audienceEdge"],
            }))
          }
          style={{
            display: "block",
            marginTop: "4px",
            width: "100%",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <option value="top">上</option>
          <option value="right">右</option>
          <option value="bottom">下</option>
          <option value="left">左</option>
        </select>
      </label>

      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "#64748b",
          lineHeight: 1.5,
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        作品名・想定人数は画面上部の
        <strong style={{ color: "#94a3b8" }}>「作品・舞台」</strong>
        欄で編集できます。舞台の寸法（メイン幅・奥行・袖・バック・場ミリ）は、中央ステージ見出し横の
        <strong style={{ color: "#94a3b8" }}>「ステージ設定」</strong>
        から開くダイアログで編集できます。
      </p>

      <div style={{ borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#94a3b8",
            marginBottom: "4px",
          }}
        >
          メンバー（名簿）
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "11px",
            color: "#64748b",
            lineHeight: 1.45,
          }}
        >
          名簿 <strong style={{ color: "#94a3b8" }}>{crews.length}</strong> 件 · メンバー合計{" "}
          <strong style={{ color: "#94a3b8" }}>
            {crews.reduce((s, c) => s + c.members.length, 0)}
          </strong>{" "}
          人。下の一覧で名前を編集できます（ステージ上の表示名簿と同期）。
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <button
            type="button"
            style={btnSecondary}
            onClick={addCrew}
            disabled={viewMode === "view"}
          >
            ＋名簿を追加
          </button>
          <button
            type="button"
            style={btnSecondary}
            disabled={viewMode === "view"}
            title="CSV ファイルや Google スプレッドシートから新しい名簿を取り込む"
            onClick={() => {
              setCrewImportOpen((v) => !v);
              setCrewImportError(null);
            }}
          >
            {crewImportOpen
              ? "取り込みパネルを閉じる"
              : "CSV / スプレッドシートから取り込み"}
          </button>
        </div>
        {crewImportOpen && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#020617",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
              名簿として取り込みたい一覧（先頭列または「名前 / label / name」見出し）を、
              CSV ファイル または Google スプレッドシートの URL から読み込みます。
              出欠は「出欠」などの見出し列に加え、氏名の左右の列が ○・参加 などのときも自動判定します。
              「フリガナ」「読み」「セイ」「メイ」列があれば名の読み＋苗字読み 1 文字で短い表示名にします。
              任意列: 「身長」「height」系（数値・cm 可）、「学年」（小学校・中学校・高校・大学・大人など）、
              「スキル」「ランク」「スキルランク」「個人ランク」「レベル」など（数字は小さいほど上手が上位で並び替え）— 名簿の列に表示されます。
            </div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
              表示名
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "12px",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="inspector-crew-import-name-mode"
                checked={crewImportNameMode === "full"}
                onChange={() => setCrewImportNameMode("full")}
              />
              フルネーム（姓＋名・氏名列をそのまま短く）
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "12px",
                color: "#e2e8f0",
                cursor: "pointer",
                marginBottom: "4px",
              }}
            >
              <input
                type="radio"
                name="inspector-crew-import-name-mode"
                checked={crewImportNameMode === "given_only"}
                onChange={() => setCrewImportNameMode("given_only")}
              />
              名だけ（「姓」「名」列推奨。同名は全員に苗字 1 文字を前置）
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              新しい名簿の名前（任意）
              <input
                type="text"
                value={crewImportName}
                placeholder={`名簿 ${crews.length + 1}`}
                disabled={viewMode === "view"}
                maxLength={60}
                onChange={(e) => setCrewImportName(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              />
            </label>
            <button
              type="button"
              style={btnSecondary}
              disabled={viewMode === "view" || crewImportBusy}
              onClick={onPickCrewCsvFile}
            >
              CSV ファイルを選んで取り込み
            </button>
            <div
              style={{
                height: "1px",
                background: "#1e293b",
                margin: "2px 0",
              }}
              aria-hidden
            />
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              Google スプレッドシートの URL
              <input
                type="url"
                value={crewImportSheetUrl}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                disabled={viewMode === "view" || crewImportBusy}
                onChange={(e) => setCrewImportSheetUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void onImportCrewFromGoogleSheets();
                  }
                }}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnPrimary}
                disabled={
                  viewMode === "view" ||
                  crewImportBusy ||
                  !crewImportSheetUrl.trim()
                }
                onClick={() => void onImportCrewFromGoogleSheets()}
              >
                {crewImportBusy ? "取得中…" : "URL から取り込み"}
              </button>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "10px",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              スプレッドシートは「リンクを知っている人は閲覧可」または「ウェブに公開」されている必要があります（取得は CSV 形式で直接行います）。
            </p>
            {crewImportError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {crewImportError}
              </p>
            )}
          </div>
        )}
        {crews.map((crew) => (
          <div
            key={crew.id}
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#020617",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                marginBottom: "4px",
              }}
            >
              名簿 · {crew.members.length} 人
            </div>
            <input
              type="text"
              value={crew.name}
              onChange={(e) => updateCrewName(crew.id, e.target.value)}
              disabled={viewMode === "view"}
              style={{
                width: "100%",
                marginBottom: "8px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #475569",
                background: "#0f172a",
                color: "#e2e8f0",
              }}
            />
            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                marginBottom: "4px",
              }}
            >
              メンバー一覧
            </div>
            <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0 }}>
              {crew.members.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    title="色（ステージのマーカー）"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background:
                        MEMBER_COLOR_SWATCHES[m.colorIndex % MEMBER_COLOR_SWATCHES.length],
                      border: "1px solid rgba(148,163,184,0.35)",
                    }}
                  />
                  <input
                    value={m.label}
                    onChange={(e) =>
                      updateMemberLabel(crew.id, m.id, e.target.value)
                    }
                    disabled={viewMode === "view"}
                    maxLength={8}
                    aria-label={`${crew.name} のメンバー名`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "6px",
                      borderRadius: "6px",
                      border: "1px solid #334155",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    style={{ ...btnSecondary, padding: "2px 6px", fontSize: "11px" }}
                    disabled={viewMode === "view"}
                    onClick={() => removeMemberFromCrew(crew.id, m.id)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                type="button"
                style={btnSecondary}
                disabled={viewMode === "view"}
                onClick={() => addMemberToCrew(crew.id)}
              >
                メンバーを名簿に追加
              </button>
              <button
                type="button"
                style={btnPrimary}
                disabled={viewMode === "view"}
                onClick={() => applyCrewToFormation(crew)}
              >
                この名簿を現在の形に反映
              </button>
              <button
                type="button"
                style={{ ...btnSecondary, color: "#f87171" }}
                disabled={viewMode === "view"}
                onClick={() => removeCrew(crew.id)}
              >
                名簿を削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label style={{ fontSize: "11px", color: "#94a3b8" }}>フォーメーション</label>
        <select
          value={editFormationId}
          onChange={(e) => {
            const fid = e.target.value;
            if (onInspectorFormationSelect) onInspectorFormationSelect(fid);
            else setProject((p) => ({ ...p, activeFormationId: fid }));
          }}
          disabled={viewMode === "view"}
          style={{
            display: "block",
            marginTop: "4px",
            width: "100%",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {cues.length > 0 && onStageLayoutEditModeChange && (
          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              style={stageLayoutEditMode ? btnPrimary : btnSecondary}
              disabled={viewMode === "view"}
              onClick={() => onStageLayoutEditModeChange(!stageLayoutEditMode)}
            >
              {stageLayoutEditMode
                ? "再生タイムの表示に戻す"
                : "ステージでこの形をドラッグ調整"}
            </button>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "10px",
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              キューがあるとステージは再生位置の補間表示になり、ダンサーをドラッグできません。上の一覧で直したいフォーメーションを選び、このボタンを押すか、ステージ上をクリックするとその保存データがステージに出るので、ドラッグして微調整できます。
            </p>
          </div>
        )}
      </div>

      <details
        style={{
          marginTop: "10px",
          borderRadius: "8px",
          border: "1px solid #1e293b",
          padding: "8px 10px",
          background: "#020617",
        }}
      >
        <summary style={{ cursor: "pointer", color: "#94a3b8", fontSize: "12px" }}>
          メモ（§11）— フォーメーション / キュー
        </summary>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ fontSize: "11px", color: "#94a3b8" }}>
            フォーメーションメモ
            <textarea
              value={activeFormation?.note ?? ""}
              disabled={viewMode === "view" || !activeFormation}
              onChange={(e) =>
                updateActiveFormation((f) => ({
                  ...f,
                  note: e.target.value.trim() ? e.target.value.slice(0, 4000) : undefined,
                }))
              }
              rows={3}
              style={{
                display: "block",
                marginTop: "4px",
                width: "100%",
                resize: "vertical",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
            />
          </label>
          {selectedCue ? (
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              選択中キューのメモはタイムライン一覧の行内テキストで編集できます。
            </div>
          ) : (
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              キューを選ぶと、そのキューのメモ欄がタイムライン側に表示されます。
            </div>
          )}
        </div>
      </details>

      <label
        style={{
          display: "block",
          marginTop: "8px",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        フォーメーション名
        <span style={{ marginLeft: "6px", color: "#64748b", fontWeight: 400 }}>
          （ダブルクリックで編集）
        </span>
      </label>
      {activeFormation &&
        (formationNameInlineEdit && viewMode !== "view" ? (
          <input
            key={editFormationId}
            type="text"
            autoFocus
            defaultValue={activeFormation.name}
            maxLength={FORMATION_NAME_MAX}
            placeholder="フォーメーション名"
            aria-label="フォーメーション名"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const v =
                raw.length > 0
                  ? raw.slice(0, FORMATION_NAME_MAX)
                  : formationNameSnapshotRef.current;
              updateActiveFormation((f) => ({ ...f, name: v }));
              setFormationNameInlineEdit(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setFormationNameInlineEdit(false);
              }
            }}
            style={{
              display: "block",
              marginTop: "4px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #6366f1",
              background: "#0f172a",
              color: "#e2e8f0",
              width: "100%",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            onDoubleClick={() => {
              if (viewMode === "view") return;
              formationNameSnapshotRef.current = activeFormation.name;
              setFormationNameInlineEdit(true);
            }}
            title={viewMode === "view" ? undefined : "ダブルクリックで名前を変更"}
            style={{
              marginTop: "4px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: activeFormation.name ? "#e2e8f0" : "#64748b",
              width: "100%",
              fontSize: "14px",
              lineHeight: 1.35,
              minHeight: "38px",
              boxSizing: "border-box",
              cursor: viewMode === "view" ? "default" : "text",
              userSelect: viewMode === "view" ? "auto" : "none",
            }}
          >
            {activeFormation.name.trim() ? activeFormation.name : "（名前をダブルクリックで入力）"}
          </div>
        ))}

      <label style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>
        フォーメーションメモ
        <textarea
          value={activeFormation?.note ?? ""}
          onChange={(e) =>
            updateActiveFormation((f) => ({
              ...f,
              note: e.target.value === "" ? undefined : e.target.value,
            }))
          }
          disabled={viewMode === "view"}
          rows={3}
          placeholder="ダンサー向けメモ（任意）"
          style={{
            display: "block",
            marginTop: "4px",
            width: "100%",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#020617",
            color: "#e2e8f0",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <button type="button" style={btnSecondary} onClick={newFormation} disabled={viewMode === "view"}>
          ＋新規
        </button>
        <button type="button" style={btnSecondary} onClick={duplicateFormation} disabled={viewMode === "view"}>
          複製
        </button>
        <button
          type="button"
          onClick={deleteFormation}
          disabled={formations.length <= 1 || viewMode === "view"}
          style={{
            ...btnSecondary,
            opacity: formations.length <= 1 ? 0.4 : 1,
          }}
        >
          削除
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <button type="button" style={btnPrimary} onClick={addDancer} disabled={viewMode === "view"}>
            ダンサーを追加（空）
          </button>
        </div>
        {crews.some((c) => c.members.length > 0) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#020617",
            }}
          >
            <label
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: "1 1 200px",
                minWidth: 0,
              }}
            >
              名簿から現在の形に追加
              <select
                aria-label="名簿のメンバーを選ぶ"
                value={addFromRosterPick}
                disabled={viewMode === "view" || rosterMembersNotOnStage.length === 0}
                onChange={(e) => setAddFromRosterPick(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: "13px",
                }}
              >
                <option value="">
                  {rosterMembersNotOnStage.length === 0
                    ? "（未配置の名簿メンバーはいません）"
                    : "メンバーを選択…"}
                </option>
                {rosterMembersNotOnStage.map(({ crewId, crewName, member }) => (
                  <option key={member.id} value={`${crewId}|${member.id}`}>
                    {crewName} — {member.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              style={btnSecondary}
              disabled={
                viewMode === "view" ||
                !addFromRosterPick ||
                rosterMembersNotOnStage.length === 0
              }
              onClick={addDancerFromRosterPick}
            >
              追加
            </button>
          </div>
        )}
      </div>

      <details
        style={{
          marginTop: "12px",
          borderRadius: "8px",
          border: "1px solid #1e293b",
          padding: "8px 10px",
          background: "#020617",
        }}
      >
        <summary style={{ cursor: "pointer", color: "#94a3b8", fontSize: "12px" }}>
          立ち位置ライブラリ（§6）— 保存・ホバープレビュー
        </summary>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ margin: 0, fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
            現在の形を保存し、人数で絞り込みできます。カードにマウスを乗せるとステージに一時プレビューされます（離すと解除）。適用は選択中キューのフォーメーションを上書きします。
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              style={btnSecondary}
              disabled={viewMode === "view" || !activeFormation}
              onClick={saveCurrentLayoutToLibrary}
            >
              現在の形を保存
            </button>
            <label style={{ fontSize: "11px", color: "#94a3b8", display: "flex", gap: "6px" }}>
              人数フィルタ
              <input
                type="number"
                min={1}
                max={100}
                placeholder="全件"
                value={libraryCountFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setLibraryCountFilter("");
                  else {
                    const n = Number(v);
                    if (Number.isFinite(n)) setLibraryCountFilter(Math.floor(n));
                  }
                }}
                style={{
                  width: "64px",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                }}
              />
            </label>
          </div>
          {filteredSavedLayouts.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              保存されたレイアウトがありません。
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
              {filteredSavedLayouts.map((sl) => (
                <li
                  key={sl.id}
                  onMouseEnter={() => onLibraryHoverPreview?.(sl.dancers)}
                  onMouseLeave={() => onLibraryHoverPreview?.(null)}
                  style={{
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>{sl.name}</div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>
                    {sl.dancers.length} 人 · 保存時 {sl.savedAtCount} 人
                  </div>
                  <button
                    type="button"
                    style={{ ...btnSecondary, marginTop: "6px", fontSize: "11px" }}
                    disabled={viewMode === "view"}
                    onClick={() => applySavedLayoutToSelectedCue(sl)}
                  >
                    選択中キューに適用
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0" }}>
          ステージのメンバー（並び替え用データ）
        </div>
        <p style={{ margin: 0, fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
          身長・学年・スキルを入れると、タイムライン上の名簿の並び替えや「名簿の並びで再配置」と同じ基準に使われます。名簿と紐づいている場合は名簿側も更新されます。
        </p>
        <label
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
          }}
        >
          名簿の並び替え基準
          <select
            value={
              project.rosterStripSortMode === "import" ||
              project.rosterStripSortMode === "height_desc" ||
              project.rosterStripSortMode === "height_asc" ||
              project.rosterStripSortMode === "grade" ||
              project.rosterStripSortMode === "skill"
                ? project.rosterStripSortMode
                : "import"
            }
            onChange={(e) =>
              setProject((p) => ({
                ...p,
                rosterStripSortMode: e.target.value as RosterStripSortMode,
              }))
            }
            disabled={viewMode === "view"}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#cbd5e1",
              maxWidth: "100%",
            }}
          >
            <option value="import">取り込み順</option>
            <option value="height_desc">身長 高い順</option>
            <option value="height_asc">身長 低い順</option>
            <option value="grade">学年順</option>
            <option value="skill">スキル順</option>
          </select>
        </label>
      </div>

      <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginTop: "10px" }}>
        ダンサー一覧（現在の形）
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {activeFormation?.dancers.map((d) => {
          const linked = resolveLinkedMember(d);
          const hCm = d.heightCm ?? linked?.heightCm;
          const gradeStr = d.gradeLabel ?? linked?.gradeLabel ?? "";
          const genderStr = d.genderLabel ?? linked?.genderLabel ?? "";
          const skillStr = d.skillRankLabel ?? linked?.skillRankLabel ?? "";
          return (
          <li
            key={d.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            {d.crewMemberId ? (
              <span
                title="名簿と紐づいています"
                style={{
                  fontSize: "10px",
                  color: "#818cf8",
                  flexShrink: 0,
                  width: "36px",
                  textAlign: "center",
                }}
              >
                名簿
              </span>
            ) : (
              <span style={{ width: "36px", flexShrink: 0 }} />
            )}
            <input
              value={d.label}
              onChange={(e) => setDancerLabel(d.id, e.target.value)}
              disabled={viewMode === "view"}
              maxLength={8}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#e2e8f0",
              }}
            />
            <button
              type="button"
              style={{ ...btnSecondary, color: "#f87171", padding: "4px 8px" }}
              onClick={() => removeDancer(d.id)}
              disabled={viewMode === "view"}
            >
              削除
            </button>
            <input
              aria-label={`${d.label} の身長（cm）`}
              title="並び替え（身長順）に使います。舞台には表示されません。"
              placeholder="身長cm"
              inputMode="decimal"
              value={
                typeof hCm === "number" && Number.isFinite(hCm) ? String(hCm) : ""
              }
              disabled={viewMode === "view"}
              onChange={(e) => setDancerHeightCm(d.id, e.target.value)}
              style={{
                width: "68px",
                flexShrink: 0,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "11px",
              }}
            />
            <input
              aria-label={`${d.label} の学年`}
              title="並び替え（学年順）に使います"
              placeholder="学年"
              value={gradeStr}
              disabled={viewMode === "view"}
              onChange={(e) => setDancerGradeLabel(d.id, e.target.value)}
              maxLength={32}
              style={{
                width: "88px",
                flexShrink: 0,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "11px",
              }}
            />
            <input
              aria-label={`${d.label} の性別`}
              title="表示・名簿同期用"
              placeholder="性別"
              value={genderStr}
              disabled={viewMode === "view"}
              onChange={(e) => setDancerGenderLabel(d.id, e.target.value)}
              maxLength={32}
              style={{
                width: "56px",
                flexShrink: 0,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "11px",
              }}
            />
            <input
              aria-label={`${d.label} のスキル`}
              title="並び替え（スキル順）に使います"
              placeholder="スキル"
              value={skillStr}
              disabled={viewMode === "view"}
              onChange={(e) => setDancerSkillRankLabel(d.id, e.target.value)}
              maxLength={24}
              style={{
                width: "72px",
                flexShrink: 0,
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "11px",
              }}
            />
            <textarea
              aria-label={`${d.label} のメモ`}
              placeholder="メモ（舞台に表示されません）"
              value={d.note ?? ""}
              disabled={viewMode === "view"}
              onChange={(e) => setDancerNote(d.id, e.target.value)}
              rows={2}
              style={{
                flex: "2 1 140px",
                minWidth: "80px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "11px",
                resize: "vertical",
              }}
            />
          </li>
          );
        })}
      </ul>
    </div>
  );
}

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  ChoreographyProjectJson,
  CrewMember,
  DancerSpot,
  RosterStripSortMode,
} from "../types/choreography";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByOrder,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { RosterPresetPickModal } from "./RosterPresetPickModal";
import {
  formatGradeLabelForDisplay,
  gradeSortKey,
  skillSortKey,
  sortStandaloneDancerSpots,
} from "../lib/rosterSortKeys";

export type { RosterStripSortMode };

/** StageBoard の DANCER_PALETTE と同じ（名簿チップの背景） */
const DANCER_PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  "#f8fafc",
] as const;

type FlatRow = {
  crewId: string;
  crewName: string;
  member: CrewMember;
  importOrder: number;
};

function sortRows(rows: FlatRow[], mode: RosterStripSortMode): FlatRow[] {
  const arr = [...rows];
  switch (mode) {
    case "import":
      return arr.sort((a, b) => a.importOrder - b.importOrder);
    case "height_desc":
      return arr.sort((a, b) => {
        const ha = a.member.heightCm;
        const hb = b.member.heightCm;
        if (ha == null && hb == null) return a.importOrder - b.importOrder;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return hb - ha || a.importOrder - b.importOrder;
      });
    case "height_asc":
      return arr.sort((a, b) => {
        const ha = a.member.heightCm;
        const hb = b.member.heightCm;
        if (ha == null && hb == null) return a.importOrder - b.importOrder;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb || a.importOrder - b.importOrder;
      });
    case "grade":
      return arr.sort((a, b) => {
        const ka = gradeSortKey(a.member.gradeLabel);
        const kb = gradeSortKey(b.member.gradeLabel);
        return ka - kb || a.importOrder - b.importOrder;
      });
    case "skill":
      return arr.sort((a, b) => {
        const ka = skillSortKey(a.member.skillRankLabel);
        const kb = skillSortKey(b.member.skillRankLabel);
        return ka - kb || a.importOrder - b.importOrder;
      });
    default:
      return arr;
  }
}

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<
    React.SetStateAction<ChoreographyProjectJson>
  >;
};

/**
 * ステージ横タイムライン列の先頭に置く名簿ストリップ。
 * 取り込んだメンバーを一覧し、並び替え・ステージへ一括追加・畳み込みができる。
 */
const ROWS_PER_PAGE = 30;

export function RosterTimelineStrip({ project, setProject }: Props) {
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [rowHeightPx, setRowHeightPx] = useState(26);
  /** 雛形選択モーダル: 未配置一括 / 名簿並びで再配置 */
  const [presetModalMode, setPresetModalMode] = useState<
    null | "bulk" | "relayout"
  >(null);
  /** 学年入力はフォーカス中だけ生文字、それ以外は短縮表示 */
  const [gradeFocusMemberId, setGradeFocusMemberId] = useState<string | null>(
    null
  );

  const flatRows = useMemo((): FlatRow[] => {
    let order = 0;
    const out: FlatRow[] = [];
    for (const crew of project.crews) {
      for (const m of crew.members) {
        out.push({
          crewId: crew.id,
          crewName: crew.name,
          member: m,
          importOrder: order++,
        });
      }
    }
    return out;
  }, [project.crews]);

  const sortMode = useMemo((): RosterStripSortMode => {
    const m = project.rosterStripSortMode;
    if (
      m === "import" ||
      m === "height_desc" ||
      m === "height_asc" ||
      m === "grade" ||
      m === "skill"
    ) {
      return m;
    }
    return "import";
  }, [project.rosterStripSortMode]);

  /** タイムライン非表示の名簿モードでは表、それ以外はチップ（プロジェクト状態で固定） */
  const tableLayout = useMemo(
    () => project.rosterHidesTimeline === true && flatRows.length > 0,
    [project.rosterHidesTimeline, flatRows.length]
  );

  const sortedRows = useMemo(
    () => sortRows(flatRows, sortMode),
    [flatRows, sortMode]
  );

  const activeFormation = useMemo(
    () => project.formations.find((f) => f.id === project.activeFormationId),
    [project.formations, project.activeFormationId]
  );

  const onStageIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of activeFormation?.dancers ?? []) {
      if (d.crewMemberId) s.add(d.crewMemberId);
    }
    return s;
  }, [activeFormation?.dancers]);

  const notOnStageCount = useMemo(
    () => flatRows.filter((r) => !onStageIds.has(r.member.id)).length,
    [flatRows, onStageIds]
  );

  /** 名簿メンバーで現在ステージにいる人数（再配置の対象） */
  const rosterOnStageCount = useMemo(
    () => sortedRows.filter((r) => onStageIds.has(r.member.id)).length,
    [sortedRows, onStageIds]
  );

  const bulkPreviewCount = useMemo(() => {
    if (!activeFormation) return 1;
    return activeFormation.dancers.length + notOnStageCount;
  }, [activeFormation, notOnStageCount]);

  const relayoutPreviewCount = useMemo(
    () => Math.max(1, activeFormation?.dancers.length ?? 1),
    [activeFormation?.dancers.length]
  );

  const collapsed = project.rosterStripCollapsed === true;

  const toggleCollapsed = useCallback(() => {
    setProject((p) => ({
      ...p,
      rosterStripCollapsed: !p.rosterStripCollapsed,
    }));
  }, [setProject]);

  const showTimelineAgain = useCallback(() => {
    setProject((p) => ({ ...p, rosterHidesTimeline: false }));
  }, [setProject]);

  const onSortModeChange = useCallback(
    (next: RosterStripSortMode) => {
      setProject((p) => ({ ...p, rosterStripSortMode: next }));
    },
    [setProject]
  );

  /** 名簿メンバーをその場編集し、ステージ上の同一 crewMemberId のスポットにも反映 */
  const updateCrewMemberInProject = useCallback(
    (
      crewId: string,
      memberId: string,
      patch: {
        label?: string;
        heightCm?: number | undefined;
        gradeLabel?: string | undefined;
        genderLabel?: string | undefined;
        skillRankLabel?: string | undefined;
      }
    ) => {
      if (project.viewMode === "view") return;
      setProject((p) => {
        const crews = p.crews.map((c) => {
          if (c.id !== crewId) return c;
          return {
            ...c,
            members: c.members.map((m) => {
              if (m.id !== memberId) return m;
              let nm: CrewMember = { ...m };
              if (patch.label !== undefined) {
                /** trim は毎回かけない。空欄も許可（ステージ表示は StageBoard 側で ? フォールバック） */
                const raw = patch.label.slice(0, 120);
                nm = { ...nm, label: raw };
              }
              if ("heightCm" in patch) {
                nm = { ...nm, heightCm: patch.heightCm };
              }
              if (patch.gradeLabel !== undefined) {
                const g = patch.gradeLabel.slice(0, 32);
                nm = {
                  ...nm,
                  gradeLabel: g.trim() ? g.trim() : undefined,
                };
              }
              if (patch.skillRankLabel !== undefined) {
                const s = patch.skillRankLabel.slice(0, 24);
                nm = {
                  ...nm,
                  skillRankLabel: s.trim() ? s.trim() : undefined,
                };
              }
              if (patch.genderLabel !== undefined) {
                const g = patch.genderLabel.slice(0, 32);
                nm = {
                  ...nm,
                  genderLabel: g.trim() ? g.trim() : undefined,
                };
              }
              return nm;
            }),
          };
        });
        const updatedMember = crews
          .flatMap((c) => c.members)
          .find((m) => m.id === memberId);
        if (!updatedMember) return p;

        const formations = p.formations.map((f) => ({
          ...f,
          dancers: f.dancers.map((d) => {
            if (d.crewMemberId !== memberId) return d;
            let nd = { ...d };
            if (patch.label !== undefined) {
              nd = {
                ...nd,
                label: updatedMember.label.trim().slice(0, 8),
              };
            }
            if ("heightCm" in patch) {
              nd = { ...nd, heightCm: patch.heightCm };
            }
            if (patch.gradeLabel !== undefined) {
              const g = patch.gradeLabel.slice(0, 32).trim();
              nd = { ...nd, gradeLabel: g ? g : undefined };
            }
            if (patch.skillRankLabel !== undefined) {
              const s = patch.skillRankLabel.slice(0, 24).trim();
              nd = { ...nd, skillRankLabel: s ? s : undefined };
            }
            if (patch.genderLabel !== undefined) {
              const g = patch.genderLabel.slice(0, 32).trim();
              nd = { ...nd, genderLabel: g ? g : undefined };
            }
            return nd;
          }),
        }));

        return { ...p, crews, formations };
      });
    },
    [project.viewMode, setProject]
  );

  /** 名簿からメンバーを削除。ステージ上の印は残し `crewMemberId` のみ解除（インスペクタと同じ） */
  const removeMemberFromRoster = useCallback(
    (crewId: string, memberId: string, labelHint: string) => {
      if (project.viewMode === "view") return;
      const label = labelHint.trim().slice(0, 60) || "このメンバー";
      const ok = window.confirm(
        `「${label}」を名簿から削除しますか？\n\nステージに立ち位置がある場合は、名簿との紐づけだけ外れます（印は残ります）。`
      );
      if (!ok) return;
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
    },
    [project.viewMode, setProject]
  );

  /** 名簿の最後のクルーにメンバーを 1 人追加（表でそのまま編集可能） */
  const addMemberToRoster = useCallback(() => {
    if (project.viewMode === "view") return;
    setProject((p) => {
      if (p.crews.length === 0) {
        return {
          ...p,
          crews: [
            {
              id: crypto.randomUUID(),
              name: "名簿 1",
              members: [
                {
                  id: crypto.randomUUID(),
                  label: "1",
                  colorIndex: 0,
                },
              ],
            },
          ],
        };
      }
      const lastIdx = p.crews.length - 1;
      return {
        ...p,
        crews: p.crews.map((crew, i) =>
          i === lastIdx
            ? {
                ...crew,
                members: [
                  ...crew.members,
                  {
                    id: crypto.randomUUID(),
                    label: String(crew.members.length + 1),
                    colorIndex: crew.members.length % 9,
                  },
                ],
              }
            : crew
        ),
      };
    });
  }, [project.viewMode, setProject]);

  useLayoutEffect(() => {
    if (!tableLayout || collapsed) return;
    const el = listScrollRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const per = Math.floor(h / ROWS_PER_PAGE);
      /** 枠内に約30行入るよう、行高の上限を抑える */
      setRowHeightPx(Math.max(18, Math.min(26, per)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableLayout, collapsed, sortedRows.length]);

  const addMemberToStage = useCallback(
    (row: FlatRow) => {
      if (project.viewMode === "view") return;
      if (!activeFormation) return;
      if (onStageIds.has(row.member.id)) return;
      setProject((p) => {
        const f = p.formations.find((x) => x.id === p.activeFormationId);
        if (!f) return p;
        const idx = f.dancers.length;
        const m = row.member;
        return {
          ...p,
          formations: p.formations.map((fm) =>
            fm.id !== f.id
              ? fm
              : {
                  ...fm,
                  dancers: [
                    ...fm.dancers,
                    {
                      id: crypto.randomUUID(),
                      label: m.label.slice(0, 8),
                      xPct: 50 + (idx % 5) * 5,
                      yPct: 40 + Math.floor(idx / 5) * 10,
                      colorIndex: m.colorIndex % 9,
                      crewMemberId: m.id,
                      ...(typeof m.heightCm === "number"
                        ? { heightCm: m.heightCm }
                        : {}),
                      ...(m.gradeLabel?.trim()
                        ? { gradeLabel: m.gradeLabel.trim().slice(0, 32) }
                        : {}),
                      ...(m.skillRankLabel?.trim()
                        ? { skillRankLabel: m.skillRankLabel.trim().slice(0, 24) }
                        : {}),
                    },
                  ],
                }
          ),
        };
      });
    },
    [activeFormation, onStageIds, project.viewMode, setProject]
  );

  const addAllNotOnStageWithPreset = useCallback(
    (presetId: LayoutPresetId) => {
      if (project.viewMode === "view") return;
      if (!activeFormation) return;
      setProject((p) => {
        const f = p.formations.find((x) => x.id === p.activeFormationId);
        if (!f) return p;
        const on = new Set(
          f.dancers.map((d) => d.crewMemberId).filter(Boolean) as string[]
        );
        const toAdd = sortedRows.filter((r) => !on.has(r.member.id));
        if (toAdd.length === 0) return p;
        const existing = [...f.dancers];
        const total = existing.length + toAdd.length;
        const opts = {
          dancerSpacingMm: p.dancerSpacingMm,
          stageWidthMm: p.stageWidthMm,
        };
        const placeholders: DancerSpot[] = [
          ...existing,
          ...toAdd.map((row) => {
            const m = row.member;
            return {
              id: crypto.randomUUID(),
              label: m.label.slice(0, 8),
              xPct: 50,
              yPct: 40,
              colorIndex: m.colorIndex % 9,
              crewMemberId: m.id,
              ...(typeof m.heightCm === "number" ? { heightCm: m.heightCm } : {}),
              ...(m.gradeLabel?.trim()
                ? { gradeLabel: m.gradeLabel.trim().slice(0, 32) }
                : {}),
              ...(m.skillRankLabel?.trim()
                ? { skillRankLabel: m.skillRankLabel.trim().slice(0, 24) }
                : {}),
            };
          }),
        ];
        const positioned = dancersForLayoutPreset(total, presetId, opts);
        const merged = transferDancerIdentitiesByOrder(positioned, placeholders);
        return {
          ...p,
          formations: p.formations.map((fm) =>
            fm.id === f.id
              ? {
                  ...fm,
                  dancers: merged,
                  confirmedDancerCount: merged.length,
                }
              : fm
          ),
        };
      });
    },
    [activeFormation, project.viewMode, setProject, sortedRows]
  );

  /**
   * 名簿の並び替え順に名簿メンバーを並べ替え、続けて名簿外の立ち位置を後ろに付け、雛形で敷き直す。
   */
  const relayoutRosterOrderWithPreset = useCallback(
    (presetId: LayoutPresetId) => {
      if (project.viewMode === "view") return;
      if (!activeFormation) return;
      setProject((p) => {
        const f = p.formations.find((x) => x.id === p.activeFormationId);
        if (!f) return p;
        const onStageCrew = new Set(
          f.dancers.map((d) => d.crewMemberId).filter(Boolean) as string[]
        );
        if (onStageCrew.size === 0) return p;

        const primary: DancerSpot[] = [];
        const primaryIds = new Set<string>();
        for (const row of sortedRows) {
          if (!onStageCrew.has(row.member.id)) continue;
          const spot = f.dancers.find((d) => d.crewMemberId === row.member.id);
          if (spot) {
            primary.push(spot);
            primaryIds.add(spot.id);
          }
        }
        const secondaryRaw = f.dancers.filter((d) => !primaryIds.has(d.id));
        const rawMode = p.rosterStripSortMode;
        const mode: RosterStripSortMode =
          rawMode === "import" ||
          rawMode === "height_desc" ||
          rawMode === "height_asc" ||
          rawMode === "grade" ||
          rawMode === "skill"
            ? rawMode
            : "import";
        const secondary = sortStandaloneDancerSpots(secondaryRaw, mode);
        const placeholders = [...primary, ...secondary];
        const total = placeholders.length;
        if (total === 0) return p;

        const opts = {
          dancerSpacingMm: p.dancerSpacingMm,
          stageWidthMm: p.stageWidthMm,
        };
        const positioned = dancersForLayoutPreset(total, presetId, opts);
        const merged = transferDancerIdentitiesByOrder(positioned, placeholders);
        return {
          ...p,
          formations: p.formations.map((fm) =>
            fm.id === f.id
              ? {
                  ...fm,
                  dancers: merged,
                  confirmedDancerCount: merged.length,
                }
              : fm
          ),
        };
      });
    },
    [activeFormation, project.viewMode, setProject, sortedRows]
  );

  const closePresetModal = useCallback(() => setPresetModalMode(null), []);

  const handlePresetModalPick = useCallback(
    (presetId: LayoutPresetId) => {
      if (presetModalMode === "bulk") {
        addAllNotOnStageWithPreset(presetId);
      } else if (presetModalMode === "relayout") {
        relayoutRosterOrderWithPreset(presetId);
      }
    },
    [
      presetModalMode,
      addAllNotOnStageWithPreset,
      relayoutRosterOrderWithPreset,
    ]
  );

  if (flatRows.length === 0) return null;

  const chipBg = (m: CrewMember) =>
    DANCER_PALETTE[m.colorIndex % DANCER_PALETTE.length];

  if (collapsed) {
    return (
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          padding: "6px 10px",
          marginBottom: "8px",
          background: "#0b1220",
          border: "1px solid #1e293b",
          borderRadius: "10px",
        }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          title="名簿パネルを開く"
          style={{
            fontSize: "12px",
            padding: "4px 10px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            cursor: "pointer",
          }}
        >
          名簿 {flatRows.length} 名
          {notOnStageCount > 0 ? (
            <span style={{ color: "#fbbf24" }}>（未配置 {notOnStageCount}）</span>
          ) : null}
          {" ▼"}
        </button>
        {project.rosterHidesTimeline === true ? (
          <button
            type="button"
            onClick={showTimelineAgain}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "8px",
              border: "1px solid #0369a1",
              background: "#0c4a6e",
              color: "#e0f2fe",
              cursor: "pointer",
            }}
          >
            タイムラインを表示
          </button>
        ) : null}
      </div>
    );
  }

  /** # + 表示名〜操作（スキル列はヘッダーが収まるよう最小幅を確保） */
  const expandedCols =
    "minmax(1.5rem,1.75rem) minmax(3.25rem,1.2fr) minmax(1.85rem,0.65fr) minmax(2.35rem,0.48fr) minmax(2rem,0.62fr) minmax(2.1rem,0.52fr) minmax(5rem,0.78fr)";

  if (tableLayout) {
    /**
     * 列幅は固定のまま、行の高さに合わせてデータ文字を可能な限り大きくする。
     * （旧 rowFs−1.5 だと 8px 前後になり小さすぎた）
     */
    const tableDataFs = Math.max(
      10,
      Math.min(15, Math.floor(rowHeightPx * 0.52) + 3)
    );
    const tableHeaderFs = Math.max(9, tableDataFs - 1);
    const tableBtnFs = Math.max(9, tableDataFs - 1);
    return (
      <>
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "4px 6px",
          marginBottom: 0,
          background: "#0b1220",
          border: "1px solid #1e293b",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: "3px",
            flexShrink: 0,
            minWidth: 0,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              minWidth: 0,
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#e2e8f0",
                flexShrink: 0,
                lineHeight: 1.15,
              }}
            >
              名簿
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="名簿パネルを隠して細いバーだけにします"
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid #f9a8d4",
                background: "#fce7f3",
                color: "#831843",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontWeight: 600,
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              隠す
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "4px",
              justifyContent: "flex-start",
              minWidth: 0,
              width: "100%",
              rowGap: "4px",
            }}
          >
            <select
              value={sortMode}
              onChange={(e) =>
                onSortModeChange(e.target.value as RosterStripSortMode)
              }
              disabled={project.viewMode === "view"}
              aria-label="名簿の並び順"
              title="名簿の並び順"
              style={{
                fontSize: "11px",
                padding: "3px 7px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                flexShrink: 0,
                minWidth: 0,
                maxWidth: "min(100%, 11.5rem)",
                boxSizing: "border-box",
                cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
              }}
            >
              <option value="import">取り込み順</option>
              <option value="height_desc">身長 高い順</option>
              <option value="height_asc">身長 低い順</option>
              <option value="grade">学年順</option>
              <option value="skill">スキル順</option>
            </select>
            <button
              type="button"
              onClick={showTimelineAgain}
              title="波形・楽曲のタイムラインを再表示します"
              style={{
                fontSize: "10px",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid #0369a1",
                background: "#0c4a6e",
                color: "#e0f2fe",
                cursor: "pointer",
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
                lineHeight: 1.35,
              }}
            >
              タイムラインを表示
            </button>
            {notOnStageCount > 0 ? (
              <button
                type="button"
                disabled={project.viewMode === "view"}
                onClick={() => setPresetModalMode("bulk")}
                title="雛形を選んで、未配置メンバーを一括追加します（既にステージにいる人＋未配置をまとめて並べます）"
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  border: "1px solid #14532d",
                  background: "#14532d",
                  color: "#dcfce7",
                  cursor:
                    project.viewMode === "view" ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                未配置を一括でステージへ
              </button>
            ) : null}
            {rosterOnStageCount > 0 ? (
              <button
                type="button"
                disabled={project.viewMode === "view"}
                onClick={() => setPresetModalMode("relayout")}
                title="名簿の並び替え順に合わせて、現在ステージ上の名簿メンバーを並べ替えて雛形で敷き直します"
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  border: "1px solid #854d0e",
                  background: "#713f12",
                  color: "#fef3c7",
                  cursor:
                    project.viewMode === "view" ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                名簿の並びで再配置
              </button>
            ) : null}
            <button
              type="button"
              disabled={project.viewMode === "view"}
              onClick={addMemberToRoster}
              title="名簿の末尾のクルーにメンバーを追加します（表示名・身長などは下の表で編集）"
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "6px",
                border: "1px solid #4c1d95",
                background: "#581c87",
                color: "#f3e8ff",
                cursor:
                  project.viewMode === "view" ? "not-allowed" : "pointer",
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              メンバー追加
            </button>
          </div>
        </div>
        <div
          ref={listScrollRef}
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "auto",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            background: "#020617",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: expandedCols,
              columnGap: "4px",
              alignItems: "stretch",
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: "#0f172a",
              borderBottom: "1px solid #334155",
              fontSize: `${tableHeaderFs}px`,
              fontWeight: 600,
              color: "#94a3b8",
              minHeight: rowHeightPx,
              padding: "0 4px",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              #
            </span>
            <span style={{ display: "flex", alignItems: "center" }}>表示名</span>
            <span style={{ display: "flex", alignItems: "center" }}>クルー</span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              身長
            </span>
            <span style={{ display: "flex", alignItems: "center" }}>学年</span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                fontSize: `${Math.max(7, tableHeaderFs - 2)}px`,
                lineHeight: 1.15,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title="スキル"
            >
              スキル
            </span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              操作
            </span>
          </div>
          {sortedRows.map((row, i) => {
            const m = row.member;
            const onStage = onStageIds.has(m.id);
            const vm = project.viewMode === "view";
            const inp: CSSProperties = {
              width: "100%",
              minWidth: 0,
              padding: "0 4px",
              borderRadius: "3px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              fontSize: `${tableDataFs}px`,
              lineHeight: 1.25,
              boxSizing: "border-box",
            };
            const heightStr =
              typeof m.heightCm === "number" && Number.isFinite(m.heightCm)
                ? String(m.heightCm)
                : "";
            return (
              <div
                key={m.id}
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: expandedCols,
                  columnGap: "4px",
                  alignItems: "center",
                  width: "100%",
                  minHeight: rowHeightPx,
                  padding: "1px 4px",
                  margin: 0,
                  borderBottom: "1px solid #1e293b",
                  background: i % 2 === 0 ? "#020617" : "#0a1020",
                  boxSizing: "border-box",
                }}
              >
                <span
                  aria-label={`${i + 1} 番目（並びは現在のソート順）`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    color: "#64748b",
                    fontSize: `${tableDataFs}px`,
                    fontVariantNumeric: "tabular-nums",
                    paddingRight: "2px",
                  }}
                >
                  {i + 1}
                </span>
                <input
                  aria-label="表示名"
                  value={m.label}
                  disabled={vm}
                  maxLength={120}
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      label: e.target.value,
                    })
                  }
                  style={{
                    ...inp,
                    fontWeight: 600,
                    borderLeft: `2px solid ${chipBg(m)}`,
                    paddingLeft: "4px",
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#94a3b8",
                    fontSize: `${tableDataFs}px`,
                    lineHeight: 1.25,
                  }}
                  title={row.crewName}
                >
                  {row.crewName}
                </span>
                <input
                  key={`hcm-${m.id}-${String(m.heightCm ?? "")}`}
                  aria-label="身長cm"
                  placeholder="—"
                  inputMode="decimal"
                  disabled={vm}
                  defaultValue={heightStr}
                  onBlur={(e) => {
                    const t = e.currentTarget.value
                      .trim()
                      .replace(/,/g, ".");
                    if (t === "") {
                      updateCrewMemberInProject(row.crewId, m.id, {
                        heightCm: undefined,
                      });
                      return;
                    }
                    const n = parseFloat(t);
                    if (!Number.isFinite(n) || n <= 0 || n >= 300) {
                      e.currentTarget.value = heightStr;
                      return;
                    }
                    updateCrewMemberInProject(row.crewId, m.id, {
                      heightCm: Math.round(n * 10) / 10,
                    });
                  }}
                  style={{ ...inp, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                />
                <input
                  aria-label="学年"
                  placeholder="学年"
                  disabled={vm}
                  title={
                    m.gradeLabel?.trim()
                      ? m.gradeLabel
                      : "小学生1年→小１ のように表示を短くします（編集はクリック）"
                  }
                  value={
                    gradeFocusMemberId === m.id
                      ? (m.gradeLabel ?? "")
                      : formatGradeLabelForDisplay(m.gradeLabel)
                  }
                  maxLength={32}
                  onFocus={() => setGradeFocusMemberId(m.id)}
                  onBlur={() =>
                    setGradeFocusMemberId((cur) =>
                      cur === m.id ? null : cur
                    )
                  }
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      gradeLabel: e.target.value,
                    })
                  }
                  style={inp}
                />
                <input
                  aria-label="スキル"
                  placeholder="スキル"
                  disabled={vm}
                  value={m.skillRankLabel ?? ""}
                  maxLength={24}
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      skillRankLabel: e.target.value,
                    })
                  }
                  style={inp}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    gap: "3px",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    disabled={vm || onStage}
                    onClick={() => addMemberToStage(row)}
                    title={
                      onStage
                        ? "すでにステージにいます"
                        : `${row.crewName} をステージに追加`
                    }
                    style={{
                      fontSize: `${tableBtnFs}px`,
                      padding: "0 5px",
                      lineHeight: 1.2,
                      borderRadius: "4px",
                      border: "1px solid #334155",
                      background: onStage ? "#1e293b" : "#0e7490",
                      color: onStage ? "#64748b" : "#ecfeff",
                      cursor: vm || onStage ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {onStage ? "済" : "追加"}
                  </button>
                  <button
                    type="button"
                    disabled={vm}
                    onClick={() => removeMemberFromRoster(row.crewId, m.id, m.label)}
                    title="名簿から削除（ステージの印は残り、名簿リンクのみ外します）"
                    style={{
                      fontSize: `${tableBtnFs}px`,
                      padding: "0 5px",
                      lineHeight: 1.2,
                      borderRadius: "4px",
                      border: "1px solid #7f1d1d",
                      background: "#450a0a",
                      color: "#fecaca",
                      cursor: vm ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: "9px", color: "#64748b", flexShrink: 0, lineHeight: 1.3, marginTop: "1px" }}>
          上部の「メンバー追加」で行を足せます。表示名・身長・学年・スキルを編集したうえで「追加」、「削除」で名簿から除外できます。並び順は上のプルダウンまたは雛形モーダル内で選べます。約{" "}
          {ROWS_PER_PAGE} 行が収まるよう行高を調整しています。
        </div>
      </div>
      <RosterPresetPickModal
        open={presetModalMode !== null}
        onClose={closePresetModal}
        title={
          presetModalMode === "bulk"
            ? "未配置を一括でステージへ"
            : presetModalMode === "relayout"
              ? "名簿の並びで再配置"
              : ""
        }
        description={
          presetModalMode === "bulk"
            ? "クイックバーと同じ雛形から選ぶと、既存の立ち位置＋未配置メンバー全体がその形に並びます。"
            : presetModalMode === "relayout"
              ? "名簿の現在の並び順（取り込み順・身長など）でステージ上の名簿メンバーを前から並べ替え、名簿にない立ち位置は後ろに続けます。"
              : undefined
        }
        previewCount={
          presetModalMode === "bulk"
            ? bulkPreviewCount
            : presetModalMode === "relayout"
              ? relayoutPreviewCount
              : 1
        }
        disabled={project.viewMode === "view"}
        project={project}
        onPickPreset={handlePresetModalPick}
        rosterSortMode={sortMode}
        onRosterSortModeChange={onSortModeChange}
      />
      </>
    );
  }

  return (
    <>
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "6px 8px",
        marginBottom: "6px",
        background: "#0b1220",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        maxHeight: "min(38vh, 280px)",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          minWidth: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            minWidth: 0,
            width: "100%",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#e2e8f0",
              lineHeight: 1.15,
            }}
          >
            名簿
          </span>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="名簿パネルを隠して細いバーだけにします"
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              borderRadius: "8px",
              border: "1px solid #f9a8d4",
              background: "#fce7f3",
              color: "#831843",
              cursor: "pointer",
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            隠す
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "4px",
            rowGap: "4px",
          }}
        >
          <select
            value={sortMode}
            onChange={(e) =>
              onSortModeChange(e.target.value as RosterStripSortMode)
            }
            disabled={project.viewMode === "view"}
            aria-label="名簿の並び順"
            title="並び替え（今後の拡張と同じ基準）"
            style={{
              fontSize: "11px",
              padding: "3px 7px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#cbd5e1",
              flexShrink: 0,
              maxWidth: "min(100%, 12rem)",
              cursor:
                project.viewMode === "view" ? "not-allowed" : "pointer",
            }}
          >
            <option value="import">取り込み順</option>
            <option value="height_desc">身長 高い順</option>
            <option value="height_asc">身長 低い順</option>
            <option value="grade">学年（小→中→高→大学→大人）</option>
            <option value="skill">スキル（数字が小さいほど上）</option>
          </select>
          {notOnStageCount > 0 ? (
            <button
              type="button"
              disabled={project.viewMode === "view"}
              onClick={() => setPresetModalMode("bulk")}
              title="雛形を選んで、未配置メンバーを一括追加します"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "8px",
                border: "1px solid #14532d",
                background: "#14532d",
                color: "#dcfce7",
                cursor:
                  project.viewMode === "view" ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              未配置を一括でステージへ
            </button>
          ) : null}
          {rosterOnStageCount > 0 ? (
            <button
              type="button"
              disabled={project.viewMode === "view"}
              onClick={() => setPresetModalMode("relayout")}
              title="名簿の並び替え順に合わせてステージ上の名簿メンバーを敷き直します"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "8px",
                border: "1px solid #854d0e",
                background: "#713f12",
                color: "#fef3c7",
                cursor:
                  project.viewMode === "view" ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              名簿の並びで再配置
            </button>
          ) : null}
        </div>
      </div>
      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          lineHeight: 1.35,
          marginTop: "0px",
        }}
      >
        学年は「小学校・中学校・高校・大学・大人」の表示に合わせて並べ替え、スキルは数字が小さいほど上手（先頭）になるように並べます。
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          overflowY: "auto",
          minHeight: 0,
          paddingBottom: "2px",
        }}
      >
        {sortedRows.map((row) => {
          const m = row.member;
          const onStage = onStageIds.has(m.id);
          const vm = project.viewMode === "view";
          const heightStr =
            typeof m.heightCm === "number" && Number.isFinite(m.heightCm)
              ? String(m.heightCm)
              : "";
          const chipInp: CSSProperties = {
            width: "100%",
            minWidth: 0,
            padding: "3px 6px",
            borderRadius: "6px",
            border: "1px solid #475569",
            background: "#020617",
            color: "#e2e8f0",
            fontSize: "11px",
            boxSizing: "border-box",
          };
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: onStage ? "1px solid #334155" : "1px solid #475569",
                borderLeft: `4px solid ${chipBg(m)}`,
                background: "#020617",
                opacity: onStage ? 0.72 : 1,
                maxWidth: "100%",
                minWidth: "min(220px, 100%)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  justifyContent: "space-between",
                }}
              >
                <input
                  aria-label="表示名"
                  value={m.label}
                  disabled={vm}
                  maxLength={120}
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      label: e.target.value,
                    })
                  }
                  style={{ ...chipInp, flex: 1, fontWeight: 700, minWidth: 0 }}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    disabled={vm || onStage}
                    onClick={() => addMemberToStage(row)}
                    title={
                      onStage
                        ? "すでにステージにいます"
                        : `${row.crewName} をステージに追加`
                    }
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #334155",
                      background: onStage ? "#1e293b" : "#0e7490",
                      color: onStage ? "#64748b" : "#ecfeff",
                      cursor: vm || onStage ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {onStage ? "済" : "追加"}
                  </button>
                  <button
                    type="button"
                    disabled={vm}
                    onClick={() => removeMemberFromRoster(row.crewId, m.id, m.label)}
                    title="名簿から削除（ステージの印は残り、名簿リンクのみ外します）"
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #7f1d1d",
                      background: "#450a0a",
                      color: "#fecaca",
                      cursor: vm ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "4px",
                }}
              >
                <input
                  key={`hcm-chip-${m.id}-${String(m.heightCm ?? "")}`}
                  aria-label="身長cm"
                  placeholder="身長cm"
                  inputMode="decimal"
                  disabled={vm}
                  defaultValue={heightStr}
                  onBlur={(e) => {
                    const t = e.currentTarget.value
                      .trim()
                      .replace(/,/g, ".");
                    if (t === "") {
                      updateCrewMemberInProject(row.crewId, m.id, {
                        heightCm: undefined,
                      });
                      return;
                    }
                    const n = parseFloat(t);
                    if (!Number.isFinite(n) || n <= 0 || n >= 300) {
                      e.currentTarget.value = heightStr;
                      return;
                    }
                    updateCrewMemberInProject(row.crewId, m.id, {
                      heightCm: Math.round(n * 10) / 10,
                    });
                  }}
                  style={chipInp}
                />
                <input
                  aria-label="学年"
                  placeholder="学年"
                  disabled={vm}
                  title={
                    m.gradeLabel?.trim()
                      ? m.gradeLabel
                      : "小学生1年→小１ のように表示を短くします（編集はクリック）"
                  }
                  value={
                    gradeFocusMemberId === m.id
                      ? (m.gradeLabel ?? "")
                      : formatGradeLabelForDisplay(m.gradeLabel)
                  }
                  maxLength={32}
                  onFocus={() => setGradeFocusMemberId(m.id)}
                  onBlur={() =>
                    setGradeFocusMemberId((cur) =>
                      cur === m.id ? null : cur
                    )
                  }
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      gradeLabel: e.target.value,
                    })
                  }
                  style={chipInp}
                />
                <input
                  aria-label="スキル"
                  placeholder="スキル"
                  disabled={vm}
                  value={m.skillRankLabel ?? ""}
                  maxLength={24}
                  onChange={(e) =>
                    updateCrewMemberInProject(row.crewId, m.id, {
                      skillRankLabel: e.target.value,
                    })
                  }
                  style={chipInp}
                />
              </div>
              <span style={{ fontSize: "9px", color: "#64748b" }} title={row.crewName}>
                {row.crewName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
    <RosterPresetPickModal
      open={presetModalMode !== null}
      onClose={closePresetModal}
      title={
        presetModalMode === "bulk"
          ? "未配置を一括でステージへ"
          : presetModalMode === "relayout"
            ? "名簿の並びで再配置"
            : ""
      }
      description={
        presetModalMode === "bulk"
          ? "クイックバーと同じ雛形から選ぶと、既存の立ち位置＋未配置メンバー全体がその形に並びます。"
          : presetModalMode === "relayout"
            ? "名簿の現在の並び順でステージ上の名簿メンバーを前から並べ替え、名簿にない立ち位置は後ろに続けます。"
            : undefined
      }
      previewCount={
        presetModalMode === "bulk"
          ? bulkPreviewCount
          : presetModalMode === "relayout"
            ? relayoutPreviewCount
            : 1
      }
      disabled={project.viewMode === "view"}
      project={project}
      onPickPreset={handlePresetModalPick}
      rosterSortMode={sortMode}
      onRosterSortModeChange={onSortModeChange}
    />
    </>
  );
}

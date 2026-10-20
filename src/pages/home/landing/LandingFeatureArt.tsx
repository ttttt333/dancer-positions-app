import type { ReactNode } from "react";

const gold = "#e8c547";
const cream = "#faf7f0";
const muted = "rgba(250,247,240,0.45)";
const panel = "#141414";
const ruby = "#c41e3a";

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 72"
      width="100%"
      height="100%"
      aria-hidden="true"
      className="lv2-feature-art__svg"
    >
      <rect x="0.5" y="0.5" width="119" height="71" rx="10" fill={panel} stroke="rgba(232,197,71,0.22)" />
      {children}
    </svg>
  );
}

/** 名簿ソート：身長などの数字リスト＋並べ替え矢印 */
function ArtRosterSort() {
  return (
    <Frame>
      <rect x="12" y="14" width="62" height="44" rx="6" fill="#0a0a0a" stroke={muted} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="24" cy={24 + i * 12} r="4" fill={i === 1 ? gold : cream} opacity={0.9} />
          <rect x="34" y={21 + i * 12} width={28 - i * 4} height="5" rx="2" fill={muted} />
          <text x="66" y={27 + i * 12} fill={gold} fontSize="8" fontFamily="Syne,sans-serif" textAnchor="end">
            {["168", "162", "155"][i]}
          </text>
        </g>
      ))}
      <path d="M92 22v28M86 28l6-8 6 8M86 44l6 8 6-8" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** センター距離：中央線と距離ラベル付きマーカー */
function ArtCenterDist() {
  return (
    <Frame>
      <rect x="14" y="16" width="92" height="42" rx="6" fill="#0a0a0a" stroke={muted} />
      <line x1="60" y1="18" x2="60" y2="56" stroke={gold} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
      <circle cx="60" cy="44" r="5" fill={gold} />
      <circle cx="36" cy="40" r="5" fill={cream} />
      <circle cx="88" cy="38" r="5" fill={cream} />
      <text x="36" y="32" fill={gold} fontSize="7" fontFamily="Syne,sans-serif" textAnchor="middle">
        1.5m
      </text>
      <text x="88" y="30" fill={gold} fontSize="7" fontFamily="Syne,sans-serif" textAnchor="middle">
        2.0m
      </text>
    </Frame>
  );
}

/** 雛形：複数フォーメーションのドット図 */
function ArtTemplates() {
  return (
    <Frame>
      {[
        { x: 16, dots: [[10, 28], [22, 20], [34, 28], [22, 36]] },
        { x: 52, dots: [[8, 22], [20, 22], [32, 22], [14, 34], [26, 34]] },
        { x: 88, dots: [[18, 18], [10, 30], [26, 30], [18, 42]] },
      ].map((card, i) => (
        <g key={i} transform={`translate(${card.x},12)`}>
          <rect width="28" height="48" rx="5" fill="#0a0a0a" stroke={i === 1 ? gold : muted} />
          {card.dots.map(([dx, dy], j) => (
            <circle key={j} cx={dx} cy={dy} r="3.2" fill={i === 1 ? gold : cream} opacity={0.95} />
          ))}
        </g>
      ))}
    </Frame>
  );
}

/** キューメモ：吹き出し＋タイムライン */
function ArtCueNotes() {
  return (
    <Frame>
      <rect x="14" y="42" width="92" height="8" rx="3" fill="#0a0a0a" stroke={muted} />
      <rect x="28" y="42" width="24" height="8" rx="3" fill={gold} opacity="0.85" />
      <path
        d="M34 14h40a6 6 0 016 6v12a6 6 0 01-6 6H48l-8 8v-8h-6a6 6 0 01-6-6V20a6 6 0 016-6z"
        fill="#0a0a0a"
        stroke={gold}
      />
      <rect x="42" y="22" width="28" height="3.5" rx="1.5" fill={cream} opacity="0.7" />
      <rect x="42" y="29" width="18" height="3.5" rx="1.5" fill={muted} />
    </Frame>
  );
}

/** 写真取り込み：ノート＋カメラ */
function ArtPhotoImport() {
  return (
    <Frame>
      <rect x="18" y="14" width="44" height="46" rx="4" fill="#0a0a0a" stroke={muted} />
      <circle cx="30" cy="28" r="3.5" fill={cream} />
      <circle cx="42" cy="24" r="3.5" fill={cream} />
      <circle cx="50" cy="32" r="3.5" fill={gold} />
      <circle cx="34" cy="40" r="3.5" fill={cream} />
      <path d="M72 28h28a4 4 0 014 4v18a4 4 0 01-4 4H72a4 4 0 01-4-4V32a4 4 0 014-4z" fill="#0a0a0a" stroke={gold} />
      <circle cx="86" cy="41" r="7" fill="none" stroke={gold} strokeWidth="2" />
      <circle cx="86" cy="41" r="3" fill={ruby} />
      <rect x="90" y="22" width="8" height="6" rx="2" fill={gold} />
    </Frame>
  );
}

/** リンク共有：リンク→端末 */
function ArtViewLink() {
  return (
    <Frame>
      <path
        d="M28 30a10 10 0 0114-14l6 6M42 42a10 10 0 01-14 14l-6-6"
        fill="none"
        stroke={gold}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M38 34l8-8" stroke={cream} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="72" y="16" width="28" height="42" rx="5" fill="#0a0a0a" stroke={muted} />
      <rect x="76" y="22" width="20" height="28" rx="2" fill="#111" stroke={gold} opacity="0.8" />
      <circle cx="86" cy="54" r="2" fill={muted} />
    </Frame>
  );
}

/** ハイライト：多数の点のうち1つだけ強調 */
function ArtHighlight() {
  return (
    <Frame>
      <rect x="14" y="14" width="92" height="44" rx="6" fill="#0a0a0a" stroke={muted} />
      {[
        [28, 28],
        [44, 36],
        [60, 24],
        [76, 34],
        [92, 28],
        [36, 46],
        [68, 46],
        [52, 40],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 3 ? 7 : 4}
          fill={i === 3 ? gold : cream}
          opacity={i === 3 ? 1 : 0.28}
        />
      ))}
    </Frame>
  );
}

/** 書き出し：動画＋PDF */
function ArtExport() {
  return (
    <Frame>
      <rect x="16" y="18" width="44" height="36" rx="6" fill="#0a0a0a" stroke={gold} />
      <path d="M32 30l14 8-14 8V30z" fill={gold} />
      <rect x="70" y="16" width="34" height="42" rx="4" fill="#0a0a0a" stroke={muted} />
      <text x="87" y="34" fill={ruby} fontSize="11" fontFamily="Syne,sans-serif" fontWeight="700" textAnchor="middle">
        PDF
      </text>
      <rect x="78" y="40" width="18" height="3" rx="1" fill={muted} />
      <rect x="78" y="46" width="12" height="3" rx="1" fill={muted} />
    </Frame>
  );
}

/** ライブラリ：積み上がる作品カード */
function ArtLibrary() {
  return (
    <Frame>
      <rect x="28" y="36" width="64" height="22" rx="4" fill="#0a0a0a" stroke={muted} transform="rotate(-6 60 47)" />
      <rect x="30" y="26" width="64" height="22" rx="4" fill="#0a0a0a" stroke={muted} transform="rotate(4 62 37)" />
      <rect x="26" y="16" width="64" height="28" rx="5" fill="#0a0a0a" stroke={gold} />
      <circle cx="42" cy="30" r="3.5" fill={cream} />
      <circle cx="54" cy="28" r="3.5" fill={gold} />
      <circle cx="66" cy="32" r="3.5" fill={cream} />
      <rect x="38" y="40" width="36" height="3" rx="1" fill={muted} />
    </Frame>
  );
}

/** 3D表示：透視ステージ */
function ArtView3d() {
  return (
    <Frame>
      <path d="M24 48L60 18l36 30v8H24v-8z" fill="#0a0a0a" stroke={gold} strokeLinejoin="round" />
      <path d="M32 48l28-22 28 22" fill="none" stroke={muted} />
      <circle cx="48" cy="40" r="3.5" fill={cream} />
      <circle cx="60" cy="34" r="3.5" fill={gold} />
      <circle cx="74" cy="42" r="3.5" fill={cream} />
      <path d="M60 18v-6M54 16h12" stroke={gold} strokeWidth="1.5" strokeLinecap="round" />
    </Frame>
  );
}

/** 多言語：地球＋文字 */
function ArtI18n() {
  return (
    <Frame>
      <circle cx="48" cy="36" r="22" fill="#0a0a0a" stroke={gold} strokeWidth="1.6" />
      <ellipse cx="48" cy="36" rx="10" ry="22" fill="none" stroke={muted} />
      <path d="M26 36h44M30 26h36M30 46h36" fill="none" stroke={muted} />
      <text x="86" y="28" fill={cream} fontSize="12" fontFamily="Syne,sans-serif" fontWeight="700">
        A
      </text>
      <text x="86" y="46" fill={gold} fontSize="13" fontFamily="Noto Sans JP,sans-serif" fontWeight="700">
        あ
      </text>
    </Frame>
  );
}

/** 同時制作：2カーソルが同じステージを編集 */
function ArtCollab() {
  return (
    <Frame>
      <rect x="16" y="14" width="88" height="44" rx="6" fill="#0a0a0a" stroke={muted} />
      <circle cx="40" cy="36" r="5" fill={cream} />
      <circle cx="62" cy="30" r="5" fill={gold} />
      <circle cx="84" cy="38" r="5" fill={cream} opacity="0.5" />
      <path d="M28 22l8 14 2-6 6-2-16-6z" fill={gold} />
      <path d="M78 48l-8-14-2 6-6 2 16 6z" fill={ruby} />
    </Frame>
  );
}

export const LANDING_FEATURE_ART: Record<string, () => ReactNode> = {
  rosterSort: ArtRosterSort,
  centerDist: ArtCenterDist,
  templates300: ArtTemplates,
  cueNotes: ArtCueNotes,
  photoImport: ArtPhotoImport,
  viewLink: ArtViewLink,
  highlight: ArtHighlight,
  export: ArtExport,
  library: ArtLibrary,
  view3d: ArtView3d,
  i18n: ArtI18n,
  collab: ArtCollab,
};

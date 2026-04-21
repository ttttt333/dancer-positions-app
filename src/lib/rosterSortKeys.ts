import type { DancerSpot, RosterStripSortMode } from "../types/choreography";

/**
 * 名簿の学年列など狭い UI 向け。保存値はそのままで、表示だけ短くする。
 * 例: 小学生1年→小１、専門学校1年→専１
 */
export function formatGradeLabelForDisplay(
  raw: string | undefined | null
): string {
  if (raw == null) return "";
  const s = raw.trim();
  if (!s) return "";

  const fw = (digits: string): string => {
    const ascii = digits.replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
    return ascii.replace(/\d/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) + 0xfee0)
    );
  };

  const tryPat = (re: RegExp, prefix: string): string | null => {
    const m = s.match(re);
    if (!m?.[1]) return null;
    return `${prefix}${fw(m[1])}`;
  };

  return (
    tryPat(/^専門学校\s*([0-9０-９]+)\s*年?/u, "専") ??
    tryPat(/^大学生\s*([0-9０-９]+)\s*年?/u, "大") ??
    tryPat(/^高校生\s*([0-9０-９]+)\s*年?/u, "高") ??
    tryPat(/^高等学校\s*([0-9０-９]+)\s*年?/u, "高") ??
    tryPat(/^高校\s*([0-9０-９]+)\s*年?/u, "高") ??
    tryPat(/^中学生\s*([0-9０-９]+)\s*年?/u, "中") ??
    tryPat(/^中学校\s*([0-9０-９]+)\s*年?/u, "中") ??
    tryPat(/^小学生\s*([0-9０-９]+)\s*年?/u, "小") ??
    tryPat(/^小学校\s*([0-9０-９]+)\s*年?/u, "小") ??
    tryPat(/^大学(?:生)?\s*([0-9０-９]+)\s*年?/u, "大") ??
    s
  );
}

/**
 * 学年表示の並び（名簿ストリップ・再配置で共通）。
 * 段階が若い順（小→中→高→大学→大人）、同段内は年次などの数字が小さい順。
 */
export function gradeSortKey(label: string | undefined): number {
  if (!label?.trim()) return 1e12;
  const t = label.trim();

  let tier = 9000;
  if (
    /小学校/u.test(t) ||
    /^小[0-9０-９]/u.test(t) ||
    /小[0-9０-９]年/u.test(t) ||
    (/小学/u.test(t) && !/中学校/u.test(t))
  ) {
    tier = 1000;
  } else if (
    /中学校/u.test(t) ||
    /^中[0-9０-９]/u.test(t) ||
    /中学[0-9０-９]/u.test(t) ||
    /中[0-9０-９]年/u.test(t) ||
    (/中学/u.test(t) && !/高校|高等学校/u.test(t))
  ) {
    tier = 2000;
  } else if (
    /高等学校|高校/u.test(t) ||
    /^高[0-9０-９]/u.test(t) ||
    /高[0-9０-９]年/u.test(t)
  ) {
    tier = 3000;
  } else if (/専門/u.test(t) || /^専[0-9０-９]/u.test(t)) {
    tier = 3750;
  } else if (/大学/u.test(t) || /^大[0-9０-９]/u.test(t)) {
    tier = 4000;
  } else if (/大人|社会人|既卒|一般/u.test(t)) {
    tier = 5000;
  }

  const numMatch = t.match(/([0-9０-９]+)/);
  let yr = 0;
  if (numMatch) {
    yr = parseInt(
      numMatch[1]!.replace(/[０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
      ),
      10
    );
    if (!Number.isFinite(yr)) yr = 0;
  }

  const tie = t.localeCompare("", "ja") / 1e9;
  return tier + yr * 5 + tie;
}

/** ランクは「数字が小さいほどスキルが高い」→ 昇順ソートで上位が先頭。 */
export function skillSortKey(label: string | undefined): number {
  if (!label?.trim()) return 999999;
  const t = label.trim();
  const ascii = t.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const numMatch = ascii.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]!);
    if (Number.isFinite(n)) return n;
  }
  const n2 = parseFloat(ascii.replace(/,/g, ".").replace(/^[〜~\-+]/, ""));
  if (Number.isFinite(n2) && /^[\s\d.,〜~\-+]+$/u.test(ascii)) {
    return n2;
  }
  const u = t.toUpperCase();
  if (u.length === 1 && "SABCD".includes(u)) {
    return 1000 + "SABCD".indexOf(u);
  }
  return 50000 + t.localeCompare("", "ja");
}

/**
 * 名簿に無い（crewMemberId なし）ダンサーを、名簿ストリップと同じモードで並べ替え。
 */
export function sortStandaloneDancerSpots(
  spots: DancerSpot[],
  mode: RosterStripSortMode
): DancerSpot[] {
  if (spots.length <= 1) return [...spots];
  const indexed = spots.map((s, i) => ({ s, i }));
  const cmp = (a: (typeof indexed)[0], b: (typeof indexed)[0]): number => {
    switch (mode) {
      case "import":
        return a.i - b.i;
      case "height_desc": {
        const ha = a.s.heightCm;
        const hb = b.s.heightCm;
        if (ha == null && hb == null) return a.i - b.i;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return hb - ha || a.i - b.i;
      }
      case "height_asc": {
        const ha = a.s.heightCm;
        const hb = b.s.heightCm;
        if (ha == null && hb == null) return a.i - b.i;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb || a.i - b.i;
      }
      case "grade":
        return (
          gradeSortKey(a.s.gradeLabel) - gradeSortKey(b.s.gradeLabel) ||
          a.i - b.i
        );
      case "skill":
        return (
          skillSortKey(a.s.skillRankLabel) - skillSortKey(b.s.skillRankLabel) ||
          a.i - b.i
        );
      default:
        return a.i - b.i;
    }
  };
  indexed.sort(cmp);
  return indexed.map((x) => x.s);
}

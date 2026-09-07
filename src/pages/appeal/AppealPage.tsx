import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import "./appeal.css";

type Feature = {
  id: string;
  kicker: string;
  titleBefore: string;
  titleAccent: string;
  titleAfter: string;
  body: string;
  mock: "music" | "pinpoint" | "presets" | "props" | "library" | "share";
};

const FEATURES: Feature[] = [
  {
    id: "music",
    kicker: "MUSIC × STAGE",
    titleBefore: "曲に合わせて、立ち位置が",
    titleAccent: "動く",
    titleAfter: "。",
    body: "波形とキューで、サビ・Aメロ・ブレイクの瞬間にフォーメーションを固定。再生しながらダブルクリックでキューを足しても、赤い再生バーは止まらない。",
    mock: "music",
  },
  {
    id: "pinpoint",
    kicker: "PRECISION",
    titleBefore: "離れた",
    titleAccent: "2人",
    titleAfter: "だけを、ピンポイントで。",
    body: "大きな囲み枠で全員を巻き込みません。選んだ2人をつなぐ線と番号で、「この2人を交換する」が一目でわかる。",
    mock: "pinpoint",
  },
  {
    id: "presets",
    kicker: "250+ PRESETS",
    titleBefore: "よく使う形は、",
    titleAccent: "一瞬",
    titleAfter: "で。",
    body: "段・V字・円・複合グループまで、人数に合わせて自動配分。足りない形は雛形に足し続けている。",
    mock: "presets",
  },
  {
    id: "props",
    kicker: "STAGE CRAFT",
    titleBefore: "大道具も、",
    titleAccent: "舞台上",
    titleAfter: "に置く。",
    body: "四角・円・三角などのプロップをステージに配置。ダンサーと大道具を同じ画面で設計できる。",
    mock: "props",
  },
  {
    id: "library",
    kicker: "LIBRARY",
    titleBefore: "作品も、チームも、",
    titleAccent: "ひとつ",
    titleAfter: "に。",
    body: "曲ごとのプロジェクト、キュー、立ち位置をまとめて管理。続きからすぐ開ける。",
    mock: "library",
  },
  {
    id: "share",
    kicker: "SHARE",
    titleBefore: "頭の中の隊形を、",
    titleAccent: "共有",
    titleAfter: "する。",
    body: "ノートやメモをフォーメーションに残して、練習前にチームへ渡せる。対面の説明コストを減らす。",
    mock: "share",
  },
];

function MockMusic() {
  return (
    <div className="ap-mock ap-mock--music" aria-hidden>
      <div className="ap-mock__chrome">
        <span>Thunder — Verse → Chorus</span>
        <span className="ap-mock__live">▶ PLAYING</span>
      </div>
      <div className="ap-mock__wave">
        {Array.from({ length: 48 }, (_, i) => (
          <i
            key={i}
            style={{
              height: `${18 + ((i * 17) % 62)}%`,
              opacity: i > 28 && i < 34 ? 1 : 0.35 + (i % 5) * 0.08,
            }}
          />
        ))}
        <div className="ap-mock__playhead" />
      </div>
      <div className="ap-mock__cues">
        <span>Intro</span>
        <span className="is-on">Cue 3 · サビ入口</span>
        <span>Bridge</span>
        <span>+</span>
      </div>
      <div className="ap-mock__stage ap-mock__stage--mini">
        <div className="ap-dot ap-dot--a" style={{ left: "22%", top: "40%" }}>
          1
        </div>
        <div className="ap-dot ap-dot--a" style={{ left: "38%", top: "55%" }}>
          2
        </div>
        <div className="ap-dot ap-dot--b" style={{ left: "55%", top: "55%" }}>
          3
        </div>
        <div className="ap-dot ap-dot--b" style={{ left: "72%", top: "40%" }}>
          4
        </div>
        <div className="ap-label-aud">客席</div>
      </div>
    </div>
  );
}

function MockPinpoint() {
  return (
    <div className="ap-mock ap-mock--pin" aria-hidden>
      <div className="ap-mock__stage">
        <div className="ap-label-back">舞台裏</div>
        {[
          [18, 28],
          [32, 30],
          [48, 26],
          [64, 32],
          [78, 28],
          [24, 52],
          [40, 58],
          [60, 56],
          [76, 50],
          [30, 78],
          [50, 82],
          [70, 76],
        ].map(([x, y], i) => (
          <div
            key={i}
            className={`ap-dot ${i === 1 || i === 10 ? "ap-dot--pin" : "ap-dot--mute"}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {i + 1}
          </div>
        ))}
        <svg className="ap-pin-link" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1="32"
            y1="30"
            x2="50"
            y2="82"
            stroke="rgba(56,189,248,0.95)"
            strokeWidth="0.6"
            strokeDasharray="1.2 1.2"
          />
        </svg>
        <div className="ap-pin-badge" style={{ left: "32%", top: "22%" }}>
          1
        </div>
        <div className="ap-pin-badge" style={{ left: "50%", top: "72%" }}>
          2
        </div>
        <div className="ap-label-aud">客席</div>
      </div>
      <div className="ap-mock__action">立ち位置を交換 · X</div>
    </div>
  );
}

function MockPresets() {
  const cells = ["V字", "4-3-4", "双峰", "円", "奥広", "W", "両翼", "台形", "千鳥", "扇", "T字", "複合"];
  return (
    <div className="ap-mock ap-mock--presets" aria-hidden>
      <div className="ap-preset-grid">
        {cells.map((label) => (
          <div key={label} className="ap-preset-card">
            <div className="ap-preset-dots" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockProps() {
  return (
    <div className="ap-mock ap-mock--props" aria-hidden>
      <div className="ap-mock__stage">
        <div className="ap-prop ap-prop--rect" />
        <div className="ap-prop ap-prop--circle" />
        <div className="ap-prop ap-prop--tri" />
        <div className="ap-dot ap-dot--a" style={{ left: "28%", top: "62%" }}>
          3
        </div>
        <div className="ap-dot ap-dot--b" style={{ left: "48%", top: "58%" }}>
          7
        </div>
        <div className="ap-dot ap-dot--c" style={{ left: "68%", top: "64%" }}>
          11
        </div>
        <div className="ap-label-aud">客席</div>
      </div>
      <div className="ap-prop-icons">
        <i className="is-rect" />
        <i className="is-circle" />
        <i className="is-line" />
        <i className="is-tri" />
      </div>
    </div>
  );
}

function MockLibrary() {
  const items = [
    { title: "Summer Showcase 2026", meta: "18 cues · 12人" },
    { title: "練習用 — サビ固め", meta: "9 cues · 11人" },
    { title: "大会決勝セット", meta: "24 cues · 16人" },
  ];
  return (
    <div className="ap-mock ap-mock--lib" aria-hidden>
      {items.map((it) => (
        <div key={it.title} className="ap-lib-card">
          <div className="ap-lib-thumb" />
          <div>
            <strong>{it.title}</strong>
            <span>{it.meta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockShare() {
  return (
    <div className="ap-mock ap-mock--share" aria-hidden>
      <div className="ap-note">
        <strong>Formation · サビ入口</strong>
        <p>手前4・中3・奥4。センターはジャンプ後に戻る。</p>
        <p>上手ウィングは1拍遅れて開く。</p>
      </div>
      <div className="ap-mock__stage ap-mock__stage--mini">
        <div className="ap-dot ap-dot--a" style={{ left: "30%", top: "45%" }}>
          A
        </div>
        <div className="ap-dot ap-dot--b" style={{ left: "50%", top: "60%" }}>
          B
        </div>
        <div className="ap-dot ap-dot--c" style={{ left: "70%", top: "45%" }}>
          C
        </div>
      </div>
    </div>
  );
}

function FeatureMock({ kind }: { kind: Feature["mock"] }) {
  switch (kind) {
    case "music":
      return <MockMusic />;
    case "pinpoint":
      return <MockPinpoint />;
    case "presets":
      return <MockPresets />;
    case "props":
      return <MockProps />;
    case "library":
      return <MockLibrary />;
    case "share":
      return <MockShare />;
  }
}

export function AppealPage() {
  return (
    <div className="ap-root">
      <header className="ap-nav">
        <Link to="/" className="ap-nav__brand" aria-label="ChoreoCore ホーム">
          <ChoreoCoreLogo height={28} />
        </Link>
        <div className="ap-nav__actions">
          <Link to="/" className="ap-link">
            ホーム
          </Link>
          <Link to="/login" className="ap-link">
            ログイン
          </Link>
          <Link to="/register" className="ap-btn ap-btn--sm">
            はじめる
          </Link>
        </div>
      </header>

      <section className="ap-hero">
        <div className="ap-hero__glow" aria-hidden />
        <div className="ap-hero__stage" aria-hidden>
          <div className="ap-hero__grid" />
          <div className="ap-dot ap-dot--a ap-hero__d" style={{ left: "18%", top: "42%" }}>
            1
          </div>
          <div className="ap-dot ap-dot--b ap-hero__d" style={{ left: "36%", top: "58%" }}>
            2
          </div>
          <div className="ap-dot ap-dot--c ap-hero__d" style={{ left: "54%", top: "48%" }}>
            3
          </div>
          <div className="ap-dot ap-dot--a ap-hero__d" style={{ left: "72%", top: "62%" }}>
            4
          </div>
          <div className="ap-dot ap-dot--b ap-hero__d" style={{ left: "86%", top: "40%" }}>
            5
          </div>
          <div className="ap-hero__wave">
            {Array.from({ length: 32 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
            <b />
          </div>
        </div>
        <div className="ap-hero__copy">
          <ChoreoCoreLogo height={52} className="ap-hero__logo" />
          <h1 className="ap-hero__title">
            曲のタイムラインと、
            <br />
            舞台の立ち位置を<span className="ap-accent-line">ひとつ</span>に。
          </h1>
          <p className="ap-hero__sub">
            ChoreoCore は、再生しながらキューを刻み、隊形を設計するダンスチーム向けツールです。
          </p>
          <div className="ap-hero__cta">
            <Link to="/register" className="ap-btn">
              無料ではじめる
            </Link>
            <a href="#features" className="ap-btn ap-btn--ghost">
              できることを見る
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="ap-features">
        {FEATURES.map((f, idx) => (
          <article
            key={f.id}
            className={`ap-feature ${idx % 2 === 1 ? "ap-feature--flip" : ""}`}
          >
            <div className="ap-feature__text">
              <p className="ap-kicker">{f.kicker}</p>
              <h2>
                {f.titleBefore}
                <span className="ap-accent-mark">{f.titleAccent}</span>
                {f.titleAfter}
              </h2>
              <p className="ap-feature__body">{f.body}</p>
            </div>
            <div className="ap-feature__visual">
              <FeatureMock kind={f.mock} />
            </div>
          </article>
        ))}
      </section>

      <section className="ap-compare">
        <h2>
          ArrangeUs が得意な「形の整理」に、
          <br />
          ChoreoCore は<span className="ap-accent-mark">音楽の時間軸</span>を足す。
        </h2>
        <ul className="ap-compare__grid">
          <li>
            <strong>波形＋キュー</strong>
            <span>再生位置と隊形が常に同期</span>
          </li>
          <li>
            <strong>ピンポイント交換</strong>
            <span>離れた2人だけを明示して入替</span>
          </li>
          <li>
            <strong>雛形ライブラリ</strong>
            <span>人数スケールの定番形をすぐ適用</span>
          </li>
          <li>
            <strong>編集中も再生継続</strong>
            <span>キュー追加で赤いバーが止まらない</span>
          </li>
        </ul>
      </section>

      <section className="ap-footer-cta">
        <ChoreoCoreLogo height={40} />
        <h2>今日の練習から、隊形を曲に乗せる。</h2>
        <Link to="/register" className="ap-btn">
          ChoreoCore を開く
        </Link>
        <p className="ap-footer-note">
          <Link to="/">ホームへ戻る</Link>
        </p>
      </section>
    </div>
  );
}

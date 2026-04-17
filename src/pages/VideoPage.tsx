import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { btnSecondary } from "../components/StageBoard";

type VideoRow = {
  id: string;
  name: string;
  mirror: boolean;
  playbackRate: number;
  bookmarks: number[];
  updatedAt: string;
};

interface VideoDb extends DBSchema {
  meta: { key: string; value: VideoRow };
  blobs: { key: string; value: ArrayBuffer };
}

let dbPromise: Promise<IDBPDatabase<VideoDb>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VideoDb>("dancer-video-module", 1, {
      upgrade(db) {
        db.createObjectStore("meta", { keyPath: "id" });
        db.createObjectStore("blobs");
      },
    });
  }
  return dbPromise;
}

export function VideoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = rows.find((r) => r.id === activeId);
  const [mirror, setMirror] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const refreshList = useCallback(async () => {
    const db = await getDb();
    const all = await db.getAll("meta");
    setRows(all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!active) return;
    setMirror(active.mirror);
    setPlaybackRate(active.playbackRate);
    setBookmarks(active.bookmarks);
    let url: string | null = null;
    (async () => {
      const db = await getDb();
      const buf = await db.get("blobs", active.id);
      const v = videoRef.current;
      if (!buf || !v) return;
      url = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
      v.src = url;
      v.load();
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playbackRate;
  }, [playbackRate]);

  const persistActivePatch = async (patch: Partial<VideoRow>) => {
    if (!activeId) return;
    const db = await getDb();
    const cur = await db.get("meta", activeId);
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    await db.put("meta", next);
    await refreshList();
  };

  const onPickVideo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const id = crypto.randomUUID();
      const r = new FileReader();
      r.onload = () => {
        void (async () => {
          const buf = r.result as ArrayBuffer;
          const db = await getDb();
          const row: VideoRow = {
            id,
            name: f.name.slice(0, 120),
            mirror: false,
            playbackRate: 1,
            bookmarks: [],
            updatedAt: new Date().toISOString(),
          };
          await db.put("blobs", buf, id);
          await db.put("meta", row);
          setActiveId(id);
          await refreshList();
        })();
      };
      r.readAsArrayBuffer(f);
    };
    input.click();
  };

  const addBookmark = () => {
    const v = videoRef.current;
    if (!v || !activeId) return;
    const t = v.currentTime;
    const next = [...bookmarks, t].sort((a, b) => a - b);
    setBookmarks(next);
    void persistActivePatch({ bookmarks: next });
  };

  const seekBookmark = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
  };

  const toggleMirror = (m: boolean) => {
    setMirror(m);
    void persistActivePatch({ mirror: m });
  };

  const setRate = (r: number) => {
    setPlaybackRate(r);
    void persistActivePatch({ playbackRate: r });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        padding: "24px",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "20px" }}>
        <Link to="/" style={{ color: "#94a3b8", textDecoration: "none" }}>
          ← 作品一覧
        </Link>
        <h1 style={{ margin: "12px 0 0", fontSize: "22px" }}>振り確認（動画）</h1>
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "8px" }}>
          端末内 IndexedDB に保存します（本番ではオブジェクトストレージ連携予定）。楽曲タイムラインとは別モジュールです。
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <button type="button" style={btnSecondary} onClick={onPickVideo}>
          動画を追加
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={mirror}
            onChange={(e) => toggleMirror(e.target.checked)}
            disabled={!activeId}
          />
          左右反転（鏡）
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          再生速度
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={playbackRate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={!activeId}
          />
          <span style={{ width: "40px" }}>{playbackRate.toFixed(2)}×</span>
        </label>
        <button type="button" style={btnSecondary} onClick={addBookmark} disabled={!activeId}>
          ブックマーク（現在位置）
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1fr) 1fr", gap: "16px" }}>
        <aside
          style={{
            border: "1px solid #1e293b",
            borderRadius: "12px",
            padding: "12px",
            maxHeight: "70vh",
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
            保存済み動画
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px",
                    marginBottom: "6px",
                    borderRadius: "8px",
                    border:
                      r.id === activeId ? "1px solid #6366f1" : "1px solid #334155",
                    background: r.id === activeId ? "#1e1b4b" : "#020617",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
          {rows.length === 0 && (
            <p style={{ color: "#64748b", fontSize: "13px" }}>まだありません</p>
          )}
        </aside>
        <div>
          <video
            ref={videoRef}
            controls
            style={{
              width: "100%",
              maxHeight: "60vh",
              borderRadius: "12px",
              border: "1px solid #334155",
              transform: mirror ? "scaleX(-1)" : undefined,
            }}
          />
          {bookmarks.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                ブックマーク
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {bookmarks.map((t, i) => (
                  <button
                    key={`${t}-${i}`}
                    type="button"
                    style={btnSecondary}
                    onClick={() => seekBookmark(t)}
                  >
                    {t.toFixed(1)}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

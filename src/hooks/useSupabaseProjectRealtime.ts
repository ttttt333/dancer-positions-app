import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import { getSupabase, isSupabaseBackend } from "../lib/supabaseClient";
import { normalizeProject } from "../lib/normalizeProject";
import type { ChoreographyProjectJson } from "../types/choreography";

/** Supabase Broadcast の 1 メッセージ上限（無料枠 256KB）に余裕を持たせる */
const MAX_INLINE_B64 = 200_000;
const SEND_DEBOUNCE_MS = 120;

type Stamp = { c: number; from: string };

type ProjectMsg = {
  kind: "project";
  stamp: Stamp;
  gz?: string;
  /** 大きすぎて送れないとき。受け手は次の保存通知で再取得する */
  tooLarge?: boolean;
};
type SavedMsg = { kind: "saved"; from: string; updatedAt: string; refetch: boolean };
type HelloMsg = { kind: "hello"; from: string };

export type RealtimePeer = { clientId: string; name: string };

function stampWins(a: Stamp, b: Stamp): boolean {
  return a.c > b.c || (a.c === b.c && a.from > b.from);
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

type Options = {
  enabled: boolean;
  serverId: number | null;
  displayName: string;
  project: ChoreographyProjectJson | null;
  applyRemoteProject: (project: ChoreographyProjectJson) => void;
  knownServerUpdatedAt: string | null;
  setKnownServerUpdatedAt: (iso: string | null) => void;
  /** 他の人の保存が送れないサイズだったとき、クラウドから読み直す */
  refetchFromServer: () => void;
};

/**
 * 保存済み作品を Supabase Realtime（private チャンネル）で同時編集する。
 * 作品 JSON 全体を後勝ち（Lamport 時刻）で同期し、他の人の保存時刻も共有して自動保存が止まらないようにする。
 */
export function useSupabaseProjectRealtime({
  enabled,
  serverId,
  displayName,
  project,
  applyRemoteProject,
  knownServerUpdatedAt,
  setKnownServerUpdatedAt,
  refetchFromServer,
}: Options): { peers: RealtimePeer[]; connected: boolean } {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const [peers, setPeers] = useState<RealtimePeer[]>([]);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const latestRef = useRef<Stamp>({ c: 0, from: "" });
  const lastJsonRef = useRef<string | null>(null);
  const sendTimerRef = useRef<number | null>(null);
  const pendingTooLargeRef = useRef(false);
  const remoteSavedAtRef = useRef<string | null>(null);
  const pointerDownRef = useRef<{ json: string | null } | null>(null);
  const pendingRemoteRef = useRef<{ stamp: Stamp; project: ChoreographyProjectJson } | null>(
    null
  );

  const cbRef = useRef({ applyRemoteProject, setKnownServerUpdatedAt, refetchFromServer });
  cbRef.current = { applyRemoteProject, setKnownServerUpdatedAt, refetchFromServer };
  const projectRef = useRef(project);
  projectRef.current = project;
  const knownRef = useRef(knownServerUpdatedAt);
  knownRef.current = knownServerUpdatedAt;
  /** 接続時点の保存時刻。これ以降に自分が保存したときだけ知らせる */
  const knownAtConnectRef = useRef<string | null>(null);

  const active = enabled && serverId != null && isSupabaseBackend();

  const applyRemote = (stamp: Stamp, next: ChoreographyProjectJson) => {
    latestRef.current = stamp;
    const normalized = normalizeProject(next);
    try {
      lastJsonRef.current = JSON.stringify(normalized);
    } catch {
      lastJsonRef.current = null;
    }
    cbRef.current.applyRemoteProject(normalized);
  };

  const sendProjectNow = () => {
    const ch = channelRef.current;
    const p = projectRef.current;
    if (!ch || !p) return;
    let json: string;
    try {
      json = JSON.stringify(p);
    } catch {
      return;
    }
    lastJsonRef.current = json;
    const stamp: Stamp = { c: latestRef.current.c + 1, from: clientId };
    latestRef.current = stamp;
    const gz = bytesToB64(gzipSync(strToU8(json), { level: 6 }));
    const payload: ProjectMsg =
      gz.length <= MAX_INLINE_B64
        ? { kind: "project", stamp, gz }
        : { kind: "project", stamp, tooLarge: true };
    pendingTooLargeRef.current = !!payload.tooLarge;
    void ch.send({ type: "broadcast", event: "msg", payload });
  };

  useEffect(() => {
    if (!active || serverId == null) return;
    const sb = getSupabase();
    let disposed = false;
    latestRef.current = { c: 0, from: "" };
    lastJsonRef.current = null;
    const topic = `choreocore-project:${serverId}`;
    const ch = sb.channel(topic, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: clientId },
      },
    });

    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      const msg = payload as ProjectMsg | SavedMsg | HelloMsg;
      if (msg.kind === "hello") {
        if (msg.from !== clientId && projectRef.current) sendProjectNow();
        return;
      }
      if (msg.kind === "saved") {
        const mine = Date.parse(knownRef.current ?? "") || 0;
        if ((Date.parse(msg.updatedAt) || 0) <= mine) return;
        remoteSavedAtRef.current = msg.updatedAt;
        cbRef.current.setKnownServerUpdatedAt(msg.updatedAt);
        if (msg.refetch) cbRef.current.refetchFromServer();
        return;
      }
      if (msg.kind !== "project" || !stampWins(msg.stamp, latestRef.current)) return;
      if (msg.tooLarge || !msg.gz) {
        latestRef.current = msg.stamp;
        return;
      }
      let next: ChoreographyProjectJson;
      try {
        next = JSON.parse(strFromU8(gunzipSync(b64ToBytes(msg.gz))));
      } catch {
        return;
      }
      if (pointerDownRef.current) {
        pendingRemoteRef.current = { stamp: msg.stamp, project: next };
        return;
      }
      applyRemote(msg.stamp, next);
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name?: string }>();
      const list: RealtimePeer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === clientId) continue;
        list.push({ clientId: key, name: String(metas[0]?.name ?? "") });
      }
      setPeers(list);
    });

    void (async () => {
      try {
        await sb.realtime.setAuth();
      } catch {
        /* 未ログインなら購読は失敗し、同期なしで通常編集を続ける */
      }
      if (disposed) return;
      ch.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          knownAtConnectRef.current = knownRef.current;
          setConnected(true);
          void ch.track({ name: displayName });
          void ch.send({
            type: "broadcast",
            event: "msg",
            payload: { kind: "hello", from: clientId } satisfies HelloMsg,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    })();
    channelRef.current = ch;

    return () => {
      disposed = true;
      channelRef.current = null;
      setConnected(false);
      setPeers([]);
      if (sendTimerRef.current != null) {
        window.clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
      void sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- チャンネルは作品と接続単位で張り直す
  }, [active, serverId, clientId]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !connected) return;
    void ch.track({ name: displayName });
  }, [displayName, connected]);

  // 自分の変更を少しまとめて送る（相手から届いた内容の反映は送り返さない）
  useEffect(() => {
    if (!active || !connected || !project) return;
    let json: string;
    try {
      json = JSON.stringify(project);
    } catch {
      return;
    }
    if (lastJsonRef.current == null) {
      // 開いた直後の内容は送らない（編集中の相手を古い保存内容で上書きしない）
      lastJsonRef.current = json;
      return;
    }
    if (json === lastJsonRef.current) return;
    if (sendTimerRef.current != null) window.clearTimeout(sendTimerRef.current);
    sendTimerRef.current = window.setTimeout(() => {
      sendTimerRef.current = null;
      sendProjectNow();
    }, SEND_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendProjectNow は ref 経由で最新を読む
  }, [project, active, connected]);

  // ドラッグ中に届いた変更は指を離してから反映する（自分が動かしていたら自分の方を優先）
  useEffect(() => {
    if (!active) return;
    const onDown = () => {
      let json: string | null = null;
      try {
        json = projectRef.current ? JSON.stringify(projectRef.current) : null;
      } catch {
        json = null;
      }
      pointerDownRef.current = { json };
    };
    const onUp = () => {
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      const pending = pendingRemoteRef.current;
      pendingRemoteRef.current = null;
      if (!pending) return;
      window.setTimeout(() => {
        let now: string | null = null;
        try {
          now = projectRef.current ? JSON.stringify(projectRef.current) : null;
        } catch {
          now = null;
        }
        const changedLocally = down?.json != null && now !== down.json;
        if (changedLocally) {
          sendProjectNow();
          return;
        }
        if (stampWins(pending.stamp, latestRef.current)) {
          applyRemote(pending.stamp, pending.project);
        }
      }, 0);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 反映処理は ref 経由
  }, [active]);

  // 自分がクラウド保存したら時刻を知らせる（相手の自動保存が「古い」と判定して止まらないように）
  useEffect(() => {
    const ch = channelRef.current;
    if (!active || !connected || !ch || !knownServerUpdatedAt) return;
    if (knownServerUpdatedAt === remoteSavedAtRef.current) return;
    if (knownServerUpdatedAt === knownAtConnectRef.current) return;
    const refetch = pendingTooLargeRef.current;
    pendingTooLargeRef.current = false;
    void ch.send({
      type: "broadcast",
      event: "msg",
      payload: {
        kind: "saved",
        from: clientId,
        updatedAt: knownServerUpdatedAt,
        refetch,
      } satisfies SavedMsg,
    });
  }, [knownServerUpdatedAt, active, connected, clientId]);

  return { peers, connected };
}

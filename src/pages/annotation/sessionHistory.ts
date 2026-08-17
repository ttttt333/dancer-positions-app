import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";

export const MAX_SESSION_HISTORY = 40;
export const HISTORY_COALESCE_MS = 400;
export const BLIND_HISTORY_PREFIX = "choreocore-blind-hist:";

export type SessionHistory = {
  stack: AnnotationSession[];
  index: number;
};

export function cloneSession(session: AnnotationSession): AnnotationSession {
  return JSON.parse(JSON.stringify(session)) as AnnotationSession;
}

export function historyStorageKey(annotatorId: string, songId: string): string {
  return `${BLIND_HISTORY_PREFIX}${annotatorId}:${songId}`;
}

export function emptyHistory(session: AnnotationSession): SessionHistory {
  return { stack: [cloneSession(session)], index: 0 };
}

export function canUndo(history: SessionHistory): boolean {
  return history.index > 0;
}

export function canRedo(history: SessionHistory): boolean {
  return history.index < history.stack.length - 1;
}

export function undoStep(history: SessionHistory): SessionHistory {
  if (!canUndo(history)) return history;
  return { ...history, index: history.index - 1 };
}

export function redoStep(history: SessionHistory): SessionHistory {
  if (!canRedo(history)) return history;
  return { ...history, index: history.index + 1 };
}

export function undoAll(history: SessionHistory): SessionHistory {
  return { ...history, index: 0 };
}

export function redoAll(history: SessionHistory): SessionHistory {
  return { ...history, index: Math.max(0, history.stack.length - 1) };
}

export function currentSnapshot(history: SessionHistory): AnnotationSession | undefined {
  const snap = history.stack[history.index];
  return snap ? cloneSession(snap) : undefined;
}

export function pushSnapshot(
  history: SessionHistory,
  session: AnnotationSession,
  now: number,
  lastPushAt: number,
  coalesceMs = HISTORY_COALESCE_MS
): { history: SessionHistory; lastPushAt: number } {
  const stack = history.stack.slice(0, history.index + 1);
  const snap = cloneSession(session);
  if (stack.length > 1 && now - lastPushAt < coalesceMs) {
    stack[stack.length - 1] = snap;
  } else {
    stack.push(snap);
    while (stack.length > MAX_SESSION_HISTORY) stack.shift();
  }
  return { history: { stack, index: stack.length - 1 }, lastPushAt: now };
}

export function parseStoredHistory(raw: string | null, fallback: AnnotationSession): SessionHistory {
  if (!raw) return emptyHistory(fallback);
  try {
    const parsed = JSON.parse(raw) as Partial<SessionHistory>;
    if (!Array.isArray(parsed.stack) || parsed.stack.length === 0) return emptyHistory(fallback);
    const index = Math.min(Math.max(0, Number(parsed.index) || 0), parsed.stack.length - 1);
    const stack = parsed.stack.map((row) => cloneSession(row as AnnotationSession));
    const tip = JSON.stringify(stack[index]);
    const cur = JSON.stringify(fallback);
    if (tip === cur) return { stack, index };
    const next = stack.slice(0, index + 1);
    next.push(cloneSession(fallback));
    while (next.length > MAX_SESSION_HISTORY) next.shift();
    return { stack: next, index: next.length - 1 };
  } catch {
    return emptyHistory(fallback);
  }
}

export function clearBlindHistoryStorage(): void {
  if (typeof localStorage === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BLIND_HISTORY_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** Never throws. On quota, drops undo snapshots from localStorage and retries. */
export function writeLocalJson(key: string, value: unknown): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch {
    clearBlindHistoryStorage();
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  }
}

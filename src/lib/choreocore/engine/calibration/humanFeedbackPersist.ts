import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import {
  HUMAN_FEEDBACK_EVALUATOR_KEY,
  HUMAN_FEEDBACK_LIMITS,
  HUMAN_FEEDBACK_STORAGE_KEY,
  HUMAN_FEEDBACK_VERSION,
} from "./humanFeedbackConfig";
import type { HumanFeedbackPersisted } from "./humanFeedbackTypes";

export type FeedbackStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const memory = new Map<string, string>();

export function memoryFeedbackStorage(): FeedbackStorage {
  return {
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
    },
  };
}

export function resetMemoryFeedbackStorage(): void {
  memory.clear();
}

export function defaultFeedbackStorage(): FeedbackStorage {
  if (typeof localStorage === "undefined") return memoryFeedbackStorage();
  return localStorage;
}

function emptyPersisted(evaluatorId: string): HumanFeedbackPersisted {
  return {
    schemaVersion: HUMAN_FEEDBACK_VERSION,
    evaluatorId,
    origins: [],
    events: [],
    records: [],
  };
}

export function anonymousEvaluatorId(storage: FeedbackStorage): string {
  const existing = storage.getItem(HUMAN_FEEDBACK_EVALUATOR_KEY);
  if (existing && existing.startsWith("anon-")) return existing;
  const id = `anon-${Math.random().toString(36).slice(2, 10)}`;
  storage.setItem(HUMAN_FEEDBACK_EVALUATOR_KEY, id);
  return id;
}

export function loadHumanFeedbackPersisted(
  storage: FeedbackStorage = defaultFeedbackStorage()
): HumanFeedbackPersisted {
  const evaluatorId = anonymousEvaluatorId(storage);
  const raw = storage.getItem(HUMAN_FEEDBACK_STORAGE_KEY);
  if (!raw) return emptyPersisted(evaluatorId);
  try {
    const parsed = JSON.parse(raw) as HumanFeedbackPersisted;
    return {
      schemaVersion: parsed.schemaVersion || HUMAN_FEEDBACK_VERSION,
      evaluatorId: parsed.evaluatorId || evaluatorId,
      origins: Array.isArray(parsed.origins) ? parsed.origins : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return emptyPersisted(evaluatorId);
  }
}

export function saveHumanFeedbackPersisted(
  data: HumanFeedbackPersisted,
  storage: FeedbackStorage = defaultFeedbackStorage()
): void {
  const trimmed: HumanFeedbackPersisted = {
    ...data,
    schemaVersion: HUMAN_FEEDBACK_VERSION,
    origins: data.origins.slice(-HUMAN_FEEDBACK_LIMITS.maxOrigins),
    events: data.events.slice(-HUMAN_FEEDBACK_LIMITS.maxEvents),
    records: (data.records ?? []).slice(-HUMAN_FEEDBACK_LIMITS.maxEvents),
  };
  storage.setItem(HUMAN_FEEDBACK_STORAGE_KEY, JSON.stringify(trimmed));
}

export function exportHumanFeedbackJson(
  data: HumanFeedbackPersisted
): string {
  return JSON.stringify({
    schemaVersion: data.schemaVersion,
    evaluationSchema: HUMAN_EVALUATION_VERSION,
    evaluatorId: data.evaluatorId,
    origins: data.origins,
    events: data.events,
    records: data.records ?? [],
  });
}

export function exportHumanFeedbackCsv(data: HumanFeedbackPersisted): string {
  const header = "evaluationId,candidateId,kind,action,layer,timestamp";
  const rows = [...data.events]
    .sort((a, b) => a.evaluationId.localeCompare(b.evaluationId))
    .map((e) =>
      [e.evaluationId, e.candidateId, e.kind, e.action, e.layer, e.timestamp]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
  return [header, ...rows].join("\n");
}

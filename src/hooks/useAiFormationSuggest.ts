/**
 * useAiFormationSuggest.ts — AI提案フック
 * 音声解析 → Supabase Edge Function (Claude) → フォーメーション提案
 */

import { useState, useCallback, useRef } from "react";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import type {
  ChoreographyProjectJson,
  Formation,
  Cue,
  DancerSpot,
} from "../types/choreography";

export type SuggestStatus = "idle" | "analyzing" | "requesting" | "done" | "error";

export interface AiSuggestResult {
  formations: Formation[];
  cues: Cue[];
  reasoning: string[];
  analysis: AudioAnalysis;
}

/** Clamp helper */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Generate UUID */
const genId = (): string => crypto.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useAiFormationSuggest(
  project: ChoreographyProjectJson,
) {
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [result, setResult] = useState<AiSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (peaks: number[], durationSec: number) => {
      // Abort previous
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("analyzing");
      setResult(null);
      setError(null);

      try {
        /* ─── Step 1: 音声解析 ─── */
        const analysis = analyzeAudio(peaks, durationSec);

        /* ─── Step 2: ダンサー情報取得 ─── */
        const activeFormation = project.formations.find(
          (f) => f.id === project.activeFormationId
        ) ?? project.formations[0];

        let dancers: { id: string; label: string; colorIndex: number }[] =
          (activeFormation?.dancers ?? []).map((d) => ({
            id: d.id,
            label: d.label,
            colorIndex: d.colorIndex,
          }));

        // ダンサー0人の場合は仮生成
        if (dancers.length === 0) {
          const count = project.pieceDancerCount ?? 6;
          dancers = Array.from({ length: count }, (_, i) => ({
            id: genId(),
            label: String(i + 1),
            colorIndex: i % 12,
          }));
        }

        setStatus("requesting");

        /* ─── Step 3: Supabase Edge Function 呼び出し ─── */
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error(
            "Supabase の設定がありません（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）"
          );
        }

        const body = {
          analysis: {
            durationSec: analysis.durationSec,
            bpm: analysis.bpm,
            sections: analysis.sections,
          },
          dancerCount: dancers.length,
          stageWidthMm: project.stageWidthMm ?? 12000,
          stageDepthMm: project.stageDepthMm ?? 8000,
          dancers,
          lang: "ja",
        };

        const res = await fetch(
          `${supabaseUrl}/functions/v1/suggest-formations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`AI提案リクエストに失敗しました (${res.status}): ${text}`);
        }

        const data = await res.json();

        /* ─── Step 4: バリデーション・補完 ─── */
        const formations: Formation[] = (data.formations ?? []).map(
          (f: any) => ({
            id: typeof f.id === "string" && f.id ? f.id : genId(),
            name: String(f.name || "AI提案"),
            dancers: (f.dancers ?? []).map((d: any) => ({
              id: typeof d.id === "string" && d.id ? d.id : genId(),
              label: String(d.label ?? d.id ?? "?"),
              xPct: clamp(Number(d.xPct) || 50, 5, 95),
              yPct: clamp(Number(d.yPct) || 50, 8, 92),
              colorIndex: typeof d.colorIndex === "number" ? d.colorIndex : 0,
            })) as DancerSpot[],
          })
        );

        const cues: Cue[] = (data.cues ?? []).map((c: any) => ({
          id: typeof c.id === "string" && c.id ? c.id : genId(),
          formationId: String(c.formationId ?? ""),
          tStartSec: Number(c.tStartSec) || 0,
          tEndSec: Number(c.tEndSec) || 10,
          name: c.name ? String(c.name) : undefined,
        }));

        const reasoning: string[] = Array.isArray(data.reasoning)
          ? data.reasoning.map(String)
          : [];

        setResult({ formations, cues, reasoning, analysis });
        setStatus("done");
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message ?? "AI提案に失敗しました");
        setStatus("error");
      }
    },
    [project]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, suggest, reset };
}

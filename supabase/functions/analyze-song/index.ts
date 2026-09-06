// supabase/functions/analyze-song
// 音源解析キャッシュ → Fly.io ANALYZER_API_URL/analyze (+ /api/v2/analyze-structure)

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** backend/analyzer/services/audio_analyzer.py の ANALYZER_VERSION と一致させる */
const ANALYZER_VERSION = "algo-v1.4.0";

async function fetchStructureV2(
  analyzerBase: string,
  audio_url: string,
  audio_hash: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${analyzerBase.replace(/\/$/, "")}/api/v2/analyze-structure`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url, audio_hash }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    if (!Array.isArray(data.sections) || data.sections.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // @ts-ignore Deno
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore Deno
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // @ts-ignore Deno
    const ANALYZER_API_URL = Deno.env.get("ANALYZER_API_URL");

    const { audio_url, audio_hash, track_title } = await req.json();
    if (!audio_hash || typeof audio_hash !== "string") {
      return new Response(JSON.stringify({ error: "audio_hash required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: cached } = await supabase
      .from("song_analysis")
      .select("*")
      .eq("audio_hash", audio_hash)
      .eq("analyzer_version", ANALYZER_VERSION)
      .maybeSingle();

    if (cached) {
      let structure_v2 = cached.structure_v2 ?? null;
      // 旧キャッシュに v2 が無いときだけ Fly から補完（失敗しても v1 は返す）
      if (
        !structure_v2 &&
        ANALYZER_API_URL &&
        typeof audio_url === "string" &&
        audio_url
      ) {
        structure_v2 = await fetchStructureV2(
          ANALYZER_API_URL,
          audio_url,
          audio_hash
        );
        if (structure_v2) {
          await supabase
            .from("song_analysis")
            .update({ structure_v2 })
            .eq("audio_hash", audio_hash)
            .eq("analyzer_version", ANALYZER_VERSION);
        }
      }
      return new Response(
        JSON.stringify({
          ...cached,
          bpm: cached.bpm,
          duration: cached.duration_seconds,
          structure_v2,
          source: "cache",
        }),
        {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    if (!ANALYZER_API_URL) {
      return new Response(
        JSON.stringify({
          error:
            "ANALYZER_API_URL not configured. Deploy backend/analyzer to Fly and set the Edge secret.",
        }),
        {
          status: 503,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    if (!audio_url) {
      return new Response(JSON.stringify({ error: "audio_url required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const base = ANALYZER_API_URL.replace(/\/$/, "");
    const [analyzeRes, structureV2] = await Promise.all([
      fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url, audio_hash }),
      }),
      fetchStructureV2(base, audio_url, audio_hash),
    ]);

    if (!analyzeRes.ok) {
      const t = await analyzeRes.text();
      return new Response(
        JSON.stringify({
          error: `analyzer failed: ${analyzeRes.status} ${t}`,
        }),
        {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }
    const result = await analyzeRes.json();

    const { data: inserted, error } = await supabase
      .from("song_analysis")
      .upsert(
        {
          audio_hash,
          track_title: track_title ?? null,
          bpm: result.bpm,
          duration_seconds: result.duration,
          eight_grid: result.eight_grid,
          change_points: result.change_points,
          section_families: result.section_families ?? null,
          song_dynamism: result.song_dynamism ?? null,
          structure_v2: structureV2,
          analyzer_version: ANALYZER_VERSION,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: "audio_hash" }
      )
      .select()
      .single();

    if (error) {
      // DB 未作成時 / カラム未追加時でも解析結果は返す
      return new Response(
        JSON.stringify({
          ...result,
          structure_v2: structureV2,
          audio_hash,
          source: "fresh",
          cache_error: error.message,
        }),
        {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ...inserted,
        duration: inserted.duration_seconds,
        structure_v2: inserted.structure_v2 ?? structureV2,
        source: "fresh",
      }),
      {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "error" }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
});

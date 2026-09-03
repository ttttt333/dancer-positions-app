// supabase/functions/analyze-song
// 音源解析キャッシュ → Fly.io ANALYZER_API_URL/analyze

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
const ANALYZER_VERSION = "algo-v1.3.0";

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
      return new Response(
        JSON.stringify({
          ...cached,
          bpm: cached.bpm,
          duration: cached.duration_seconds,
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

    const analyzeRes = await fetch(
      `${ANALYZER_API_URL.replace(/\/$/, "")}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url, audio_hash }),
      }
    );
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
          song_dynamism: result.song_dynamism ?? null,
          analyzer_version: ANALYZER_VERSION,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: "audio_hash" }
      )
      .select()
      .single();

    if (error) {
      // DB 未作成時でも解析結果は返す（フロントは動く）
      return new Response(
        JSON.stringify({
          ...result,
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

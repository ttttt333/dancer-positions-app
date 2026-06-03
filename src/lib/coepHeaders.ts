/**
 * FFmpeg.wasm（SharedArrayBuffer）向け COOP/COEP。
 * require-corp だと Supabase 音源や Vercel 注入脚本がブロックされやすいため credentialless を使用。
 */
export const COEP_HEADER_VALUE = "credentialless" as const;
export const COOP_HEADER_VALUE = "same-origin-allow-popups" as const;

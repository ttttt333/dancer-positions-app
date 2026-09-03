/**
 * Formation Reconstruction Engine のゲート。
 * 未設定は ON。`"0"` / `"false"` / `"off"` で旧経路（均等グリッド）に戻せる。
 */
export function isFormationImportEngineEnabled(): boolean {
  const raw = String(import.meta.env.VITE_FORMATION_IMPORT_ENGINE ?? "1")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

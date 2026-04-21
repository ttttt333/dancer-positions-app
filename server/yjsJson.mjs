/**
 * ChoreographyProjectJson 互換オブジェクト ↔ Yjs Map/Array（サーバ側のみ）
 */
import * as Y from "yjs";

/**
 * @param {Y.Doc} ydoc
 * @param {unknown} json
 */
export function applyProjectJsonToDoc(ydoc, json) {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return;
  Y.transact(ydoc, () => {
    const root = ydoc.getMap("root");
    root.clear();
    fillMapFromObject(root, /** @type {Record<string, unknown>} */ (json));
  });
}

/**
 * @param {Y.Map<unknown>} ymap
 * @param {Record<string, unknown>} obj
 */
function fillMapFromObject(ymap, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null || typeof v !== "object") {
      ymap.set(k, v);
    } else if (Array.isArray(v)) {
      const ya = new Y.Array();
      ymap.set(k, ya);
      fillArray(ya, v);
    } else {
      const inner = new Y.Map();
      ymap.set(k, inner);
      fillMapFromObject(inner, /** @type {Record<string, unknown>} */ (v));
    }
  }
}

/**
 * @param {Y.Array<unknown>} ya
 * @param {unknown[]} arr
 */
function fillArray(ya, arr) {
  for (const item of arr) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const nm = new Y.Map();
      fillMapFromObject(nm, /** @type {Record<string, unknown>} */ (item));
      ya.push([nm]);
    } else if (Array.isArray(item)) {
      const nested = new Y.Array();
      ya.push([nested]);
      fillArray(nested, item);
    } else {
      ya.push([item]);
    }
  }
}

/**
 * @param {Y.Doc} ydoc
 * @returns {unknown}
 */
export function yDocToProjectJson(ydoc) {
  const root = ydoc.getMap("root");
  return yMapToObject(root);
}

/**
 * @param {Y.Map<unknown>} ymap
 */
function yMapToObject(ymap) {
  /** @type {Record<string, unknown>} */
  const o = {};
  ymap.forEach((val, key) => {
    if (val instanceof Y.Map) {
      o[key] = yMapToObject(val);
    } else if (val instanceof Y.Array) {
      o[key] = yArrayToArray(val);
    } else {
      o[key] = val;
    }
  });
  return o;
}

/**
 * @param {Y.Array<unknown>} ya
 */
function yArrayToArray(ya) {
  const out = [];
  ya.forEach((val) => {
    if (val instanceof Y.Map) {
      out.push(yMapToObject(val));
    } else if (val instanceof Y.Array) {
      out.push(yArrayToArray(val));
    } else {
      out.push(val);
    }
  });
  return out;
}

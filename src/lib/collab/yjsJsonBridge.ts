/**
 * サーバ `server/yjsJson.mjs` と同じ規則で JSON ↔ Y.Doc.root Map
 */
import * as Y from "yjs";

export function applyProjectJsonToDoc(ydoc: Y.Doc, json: unknown): void {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return;
  Y.transact(ydoc, () => {
    const root = ydoc.getMap("root");
    root.clear();
    fillMapFromObject(root, json as Record<string, unknown>);
  });
}

function fillMapFromObject(
  ymap: Y.Map<unknown>,
  obj: Record<string, unknown>
): void {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null || typeof v !== "object") {
      ymap.set(k, v);
    } else if (Array.isArray(v)) {
      const ya = new Y.Array<unknown>();
      ymap.set(k, ya);
      fillArray(ya, v);
    } else {
      const inner = new Y.Map<unknown>();
      ymap.set(k, inner);
      fillMapFromObject(inner, v as Record<string, unknown>);
    }
  }
}

function fillArray(ya: Y.Array<unknown>, arr: unknown[]): void {
  for (const item of arr) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const nm = new Y.Map<unknown>();
      fillMapFromObject(nm, item as Record<string, unknown>);
      ya.push([nm]);
    } else if (Array.isArray(item)) {
      const nested = new Y.Array<unknown>();
      ya.push([nested]);
      fillArray(nested, item);
    } else {
      ya.push([item]);
    }
  }
}

export function yDocToProjectJson(ydoc: Y.Doc): unknown {
  const root = ydoc.getMap("root");
  return yMapToObject(root);
}

function yMapToObject(ymap: Y.Map<unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
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

function yArrayToArray(ya: Y.Array<unknown>): unknown[] {
  const out: unknown[] = [];
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

/**
 * 🚀 タップ精度改善：当たり判定を広げるユーティリティ
 */

const HIT_AREA = 20; // px広げる

export function expandHitArea(x: number, y: number, element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const expandedRect = {
    left: rect.left - HIT_AREA,
    right: rect.right + HIT_AREA,
    top: rect.top - HIT_AREA,
    bottom: rect.bottom + HIT_AREA,
  };
  
  return x >= expandedRect.left && 
         x <= expandedRect.right && 
         y >= expandedRect.top && 
         y <= expandedRect.bottom;
}

export function findDancerAtPoint(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  if (element?.closest('[data-dancer-id]')) {
    return element.closest('[data-dancer-id]')?.getAttribute('data-dancer-id') || null;
  }
  
  // 当たり判定を広げて再検索
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el?.closest('[data-dancer-id]')) {
      const dancerEl = el.closest('[data-dancer-id]');
      if (dancerEl && expandHitArea(x, y, dancerEl)) {
        return dancerEl.getAttribute('data-dancer-id') || null;
      }
    }
  }
  
  return null;
}

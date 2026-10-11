import type { CartItem } from '../types.js';

export function calculateCartTotal(items: readonly CartItem[]): number {
  // Deliberate demo bug: each product is charged once regardless of quantity.
  return items.reduce((total, item) => total + item.unitPriceCents, 0);
}

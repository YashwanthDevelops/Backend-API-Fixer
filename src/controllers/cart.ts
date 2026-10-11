import type { Request, Response } from 'express';
import type { DemoData } from '../types.js';
import { calculateCartTotal } from '../helpers/cart-total.js';

export function getCartTotal(data: DemoData, request: Request, response: Response): void {
  const cartId = request.params.id;
  const items = typeof cartId === 'string' ? data.carts[cartId] : undefined;
  if (!items) {
    response.status(404).json({ error: { code: 'CART_NOT_FOUND' } });
    return;
  }
  response.json({ total_cents: calculateCartTotal(items) });
}

import type { Request, Response } from 'express';

export function createOrder(request: Request, response: Response): void {
  // Deliberate demo bug: quantities are accepted without domain validation.
  const input: unknown = request.body;
  if (typeof input !== 'object' || input === null || !('quantity' in input)) {
    response.status(400).json({ error: { code: 'QUANTITY_REQUIRED' } });
    return;
  }
  response.status(201).json({ id: 'order-demo', quantity: input.quantity });
}

import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { demoData } from './data.js';
import type { DemoData } from './types.js';
import { getUser } from './controllers/users.js';
import { createOrder } from './controllers/orders.js';
import { getCartTotal } from './controllers/cart.js';

export interface FailureObservation {
  error: Error;
  method: string;
  routeTemplate: string;
  requestId: string;
}

export function createApp(options: { data?: DemoData; onError?: (failure: FailureObservation) => void } = {}) {
  const app = express();
  const data = options.data ?? demoData;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb' }));
  app.get('/health', (_request, response) => { response.json({ ok: true }); });
  app.get('/users/:id', (request, response) => { getUser(data, request, response); });
  app.post('/orders', createOrder);
  app.get('/cart/:id/total', (request, response) => { getCartTotal(data, request, response); });
  const errors: ErrorRequestHandler = (failure: unknown, request, response, _next) => {
    const error = failure instanceof Error ? failure : new Error('Unknown application error');
    try {
      options.onError?.({ error, method: request.method, routeTemplate: typeof request.route?.path === 'string' ? request.route.path : '/unknown', requestId: randomUUID() });
    } catch { /* The transport callback cannot affect the response. */ }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  };
  app.use(errors);
  return app;
}

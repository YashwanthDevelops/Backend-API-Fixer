import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { createFixtureApp } from '../support/fixtures.js';
import { createApp } from '../../src/app.js';
import type { User } from '../../src/types.js';

describe('existing supported behavior', () => {
  it('returns the existing public user', async () => {
    const response = await supertest(createFixtureApp('users-existing')).get('/users/u-1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'u-1', name: 'Avery Demo', email: 'avery@example.test' });
  });
  it('creates a positive-quantity order', async () => {
    const response = await supertest(createFixtureApp('orders-invalid'))
      .post('/orders')
      .send({ quantity: 2 });
    expect(response.status).toBe(201);
    expect(response.body.quantity).toBe(2);
  });
  it('returns zero for an empty cart', async () => {
    const response = await supertest(createFixtureApp('cart-multiple')).get('/cart/empty/total');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total_cents: 0 });
  });
  it('returns a single-item cart total', async () => {
    const response = await supertest(createFixtureApp('cart-multiple')).get('/cart/single/total');
    expect(response.body).toEqual({ total_cents: 1250 });
  });
  it('preserves an unexpected fault as 500 even if telemetry throws', async () => {
    const app = createApp({
      data: {
        get users(): readonly User[] {
          throw new Error('Synthetic storage failure');
        },
        carts: {},
      },
      onError: () => {
        throw new Error('Synthetic telemetry failure');
      },
    });
    const response = await supertest(app).get('/users/u-1');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR' } });
  });
});

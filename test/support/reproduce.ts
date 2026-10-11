import supertest from 'supertest';
import { createFixtureApp, fixtureIds, type FixtureId } from './fixtures.js';
import type { FailureObservation } from '../../src/app.js';

const fixture = process.argv[2] ?? 'users-missing';
if (!fixtureIds.some((entry) => entry === fixture)) throw new Error('Unknown fixture ID');
const fixtureId = fixture as FixtureId;
const observations: FailureObservation[] = [];
const client = supertest(
  createFixtureApp(fixtureId, (failure) => {
    observations.push(failure);
  }),
);
const response =
  fixtureId === 'orders-invalid'
    ? await client.post('/orders').send({ quantity: -2 })
    : await client.get(
        fixtureId === 'users-existing'
          ? '/users/u-1'
          : fixtureId === 'cart-multiple'
            ? '/cart/cart-1/total'
            : '/users/missing',
      );
const first = observations[0];
console.log(
  JSON.stringify({
    fixture_id: fixtureId,
    status: response.status,
    body: response.body as unknown,
    error: first
      ? { name: first.error.name, message: first.error.message, stack: first.error.stack }
      : null,
  }),
);

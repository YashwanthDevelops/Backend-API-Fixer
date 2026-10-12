import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createFixtureApp } from '../support/fixtures.js';
import { createApp } from '../../src/app.js';
import { assertionContracts } from '../../src/contract-monitor.js';
import { makeFailureEvent } from '../../src/telemetry.js';
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

  it('keeps owner-authored monitors aligned with the approved behavior contract', async () => {
    const contract = JSON.parse(
      await readFile(new URL('../../.tracefix/behavior.json', import.meta.url), 'utf8'),
    ) as {
      cases: {
        id: string;
        fixture_id: string;
        method: string;
        path: string;
        expected_status: number;
        expected_body: unknown;
      }[];
    };
    expect(
      assertionContracts.map((monitor) => {
        const behavior = contract.cases.find((entry) => entry.id === monitor.id);
        return {
          id: monitor.id,
          fixture_id: monitor.fixtureId,
          method: monitor.method,
          path: monitor.path,
          expected_status: monitor.expectedStatus,
          expected_body: monitor.expectedBody,
          matches_behavior: Boolean(
            behavior &&
              behavior.fixture_id === monitor.fixtureId &&
              behavior.method === monitor.method &&
              behavior.path === monitor.path &&
              behavior.expected_status === monitor.expectedStatus &&
              JSON.stringify(behavior.expected_body) === JSON.stringify(monitor.expectedBody),
          ),
        };
      }),
    ).toEqual(
      assertionContracts.map((monitor) => ({
        id: monitor.id,
        fixture_id: monitor.fixtureId,
        method: monitor.method,
        path: monitor.path,
        expected_status: monitor.expectedStatus,
        expected_body: monitor.expectedBody,
        matches_behavior: true,
      })),
    );
  });

  it.each([
    {
      fixture: 'orders-invalid' as const,
      caseId: 'orders-invalid-400',
      send: (client: ReturnType<typeof supertest>) =>
        client
          .post('/orders')
          .set('x-tracefix-contract-case', 'orders-invalid-400')
          .send({ quantity: -2 }),
      source: 'src/controllers/orders.ts',
      functionName: 'createOrder',
      status: 201,
    },
    {
      fixture: 'cart-multiple' as const,
      caseId: 'cart-multiple-total',
      send: (client: ReturnType<typeof supertest>) =>
        client.get('/cart/cart-1/total').set('x-tracefix-contract-case', 'cart-multiple-total'),
      source: 'src/controllers/cart.ts',
      functionName: 'getCartTotal',
      status: 200,
    },
  ])('emits a pinned assertion event for $caseId', async (scenario) => {
    const observations: import('../../src/contract-monitor.js').AssertionObservation[] = [];
    const client = supertest(
      createFixtureApp(scenario.fixture, undefined, (observation) =>
        observations.push(observation),
      ),
    );
    const response = await scenario.send(client);
    expect(response.status).toBe(scenario.status);
    expect(observations).toHaveLength(1);
    const observed = observations[0];
    expect(observed?.contractCaseId).toBe(scenario.caseId);
    expect(observed?.fixtureId).toBe(scenario.fixture);
    expect(observed?.error.name).toBe('AssertionError');

    const event = makeFailureEvent(observed!.error, {
      commitSha: 'a'.repeat(40),
      repositoryRoot: fileURLToPath(new URL('../..', import.meta.url)),
      method: observed!.method,
      routeTemplate: observed!.routeTemplate,
      requestId: observed!.requestId,
      fixtureId: observed!.fixtureId,
      contractCaseId: observed!.contractCaseId,
      kind: 'assertion_failure',
    });
    expect(event.error.kind).toBe('assertion_failure');
    expect(event.request.contract_case_id).toBe(scenario.caseId);
    expect(event.error.frames[0]).toMatchObject({
      file: scenario.source,
      function: scenario.functionName,
    });
  });
});

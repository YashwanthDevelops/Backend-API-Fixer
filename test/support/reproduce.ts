import supertest from 'supertest';
import { createFixtureApp, fixtureIds, type FixtureId } from './fixtures.js';
import type { FailureObservation } from '../../src/app.js';
import type { AssertionObservation } from '../../src/contract-monitor.js';

const fixture = process.argv[2] ?? 'users-missing';
if (!fixtureIds.some((entry) => entry === fixture)) throw new Error('Unknown fixture ID');
const fixtureId = fixture as FixtureId;
const observations: (FailureObservation | AssertionObservation)[] = [];
const caseId = process.argv[3];
const client = supertest(
  createFixtureApp(
    fixtureId,
    (failure) => {
      observations.push(failure);
    },
    (failure) => {
      observations.push(failure);
    },
  ),
);
const response =
  fixtureId === 'orders-invalid'
    ? await (
        caseId
          ? client.post('/orders').set('x-tracefix-contract-case', caseId)
          : client.post('/orders')
      ).send({ quantity: -2 })
    : fixtureId === 'cart-multiple'
      ? await (caseId
          ? client.get('/cart/cart-1/total').set('x-tracefix-contract-case', caseId)
          : client.get('/cart/cart-1/total'))
      : await client.get(fixtureId === 'users-existing' ? '/users/u-1' : '/users/missing');
const first = observations[0];
console.log(
  JSON.stringify({
    fixture_id: fixtureId,
    status: response.status,
    body: response.body as unknown,
    kind: first ? ('contractCaseId' in first ? 'assertion_failure' : 'exception') : null,
    contract_case_id: first && 'contractCaseId' in first ? first.contractCaseId : null,
    error: first
      ? { name: first.error.name, message: first.error.message, stack: first.error.stack }
      : null,
  }),
);

import { createApp, type FailureObservation } from '../../src/app.js';
import type { AssertionObservation } from '../../src/contract-monitor.js';
import { demoData } from '../../src/data.js';

export const fixtureIds = [
  'users-missing',
  'users-existing',
  'orders-invalid',
  'cart-multiple',
] as const;
export type FixtureId = (typeof fixtureIds)[number];

export function createFixtureApp(
  fixtureId: FixtureId,
  onError?: (observation: FailureObservation) => void,
  onAssertion?: (observation: AssertionObservation) => void,
) {
  if (!fixtureIds.includes(fixtureId)) throw new Error('Unknown fixture');
  return createApp({
    data: demoData,
    ...(onError ? { onError } : {}),
    ...(onAssertion ? { onAssertion } : {}),
  });
}

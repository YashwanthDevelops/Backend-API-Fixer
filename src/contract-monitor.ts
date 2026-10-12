import { isDeepStrictEqual } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface AssertionObservation {
  error: Error;
  method: string;
  routeTemplate: string;
  requestId: string;
  fixtureId: string;
  contractCaseId: string;
}

export interface AssertionContract {
  id: string;
  fixtureId: string;
  method: 'GET' | 'POST';
  path: string;
  expectedStatus: number;
  expectedBody: unknown;
  matchesRequest(request: Request): boolean;
}

// These monitors are authored by the demo owner and cross-checked against
// .tracefix/behavior.json in the baseline tests. They run only for explicit
// contract-case requests, never by guessing from successful response traffic.
export const assertionContracts: readonly AssertionContract[] = [
  {
    id: 'orders-invalid-400',
    fixtureId: 'orders-invalid',
    method: 'POST',
    path: '/orders',
    expectedStatus: 400,
    expectedBody: { error: { code: 'INVALID_QUANTITY' } },
    matchesRequest: (request) =>
      typeof request.body === 'object' &&
      request.body !== null &&
      'quantity' in request.body &&
      request.body.quantity === -2,
  },
  {
    id: 'cart-multiple-total',
    fixtureId: 'cart-multiple',
    method: 'GET',
    path: '/cart/cart-1/total',
    expectedStatus: 200,
    expectedBody: { total_cents: 4000 },
    matchesRequest: (request) => request.path === '/cart/cart-1/total',
  },
];

function describe(value: unknown): string {
  try {
    return (JSON.stringify(value) ?? 'undefined').slice(0, 500);
  } catch {
    return '[unserializable response body]';
  }
}

export function assertionMonitor(onAssertion?: (observation: AssertionObservation) => void) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const caseId = request.get('x-tracefix-contract-case');
    const contract = assertionContracts.find(
      (candidate) =>
        candidate.id === caseId &&
        candidate.method === request.method &&
        candidate.matchesRequest(request),
    );
    if (!contract || !onAssertion) {
      next();
      return;
    }

    const originalJson = response.json.bind(response);
    const wrappedJson = function (body: unknown) {
      const status = response.statusCode;
      if (
        status < 500 &&
        (status !== contract.expectedStatus || !isDeepStrictEqual(body, contract.expectedBody))
      ) {
        const actual = describe(body);
        const expected = describe(contract.expectedBody);
        const error = new Error(
          `Contract ${contract.id} expected HTTP ${contract.expectedStatus} and body ${expected}; received HTTP ${status} and body ${actual}.`,
        );
        error.name = 'AssertionError';
        Error.captureStackTrace(error, wrappedJson);
        try {
          onAssertion({
            error,
            method: request.method,
            routeTemplate: contract.path === '/orders' ? '/orders' : '/cart/:id/total',
            requestId: randomUUID(),
            fixtureId: contract.fixtureId,
            contractCaseId: contract.id,
          });
        } catch {
          /* Assertion delivery cannot change the application response. */
        }
      }
      return originalJson(body);
    };
    response.json = wrappedJson as Response['json'];
    next();
  };
}

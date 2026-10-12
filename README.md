# TraceFix demo backend

This independent repository intentionally contains three bugs. It is an owner-controlled repair target with synthetic fixtures. `GET /users/missing` returns 500 because the controller dereferences a missing user. `POST /orders` accepts a negative quantity, and `GET /cart/cart-1/total` omits item quantities from the total. Normal-case tests pass before repair; expected behavior is specified independently in `.tracefix/behavior.json`.

Repository code is validated through the platform's disposable Linux runner. Avoid running customer test/configuration code directly on the host. The platform builds a locked dependency image from this directory with lifecycle scripts disabled.

Commit all source changes before building a release. The build embeds the exact Git SHA; `node --enable-source-maps` maps runtime frames to TypeScript. Configure `TRACEFIX_LOG_URL` and `TRACEFIX_INGESTION_TOKEN` in the runtime environment to send bounded asynchronous events. Logging failures never change HTTP responses.

## Triggering the assertion monitors

Successful responses are not scanned or judged by the platform. These two demo cases use explicit owner-authored monitors in `src/contract-monitor.ts`, checked against `.tracefix/behavior.json`. To emit their structured `assertion_failure` events, include the matching contract-case header:

```sh
curl -X POST http://127.0.0.1:4312/orders \
  -H 'content-type: application/json' \
  -H 'x-tracefix-contract-case: orders-invalid-400' \
  -d '{"quantity":-2}'

curl http://127.0.0.1:4312/cart/cart-1/total \
  -H 'x-tracefix-contract-case: cart-multiple-total'
```

Without an exact monitored request, no assertion event is emitted. The request still gets its ordinary API response. Event delivery remains asynchronous and bounded. `npm run reproduce -- orders-invalid orders-invalid-400` and `npm run reproduce -- cart-multiple cart-multiple-total` exercise the same monitor path locally.

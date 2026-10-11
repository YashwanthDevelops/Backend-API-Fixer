# TraceFix demo backend

This independent repository intentionally contains three bugs. It is an owner-controlled repair target with synthetic fixtures. `GET /users/missing` returns 500 because the controller dereferences a missing user. Normal-case tests pass before repair; the expected 404 is specified independently in `.tracefix/behavior.json`.

Repository code is validated through the platform's disposable Linux runner. Avoid running customer test/configuration code directly on the host. The platform builds a locked dependency image from this directory with lifecycle scripts disabled.

Commit all source changes before building a release. The build embeds the exact Git SHA; `node --enable-source-maps` maps runtime frames to TypeScript. Configure `TRACEFIX_LOG_URL` and `TRACEFIX_INGESTION_TOKEN` in the runtime environment to send bounded asynchronous events. Logging failures never change HTTP responses.

The orders/cart bugs are reserved for later assertion-event demonstrations. Exception telemetry alone cannot detect their incorrect successful responses.

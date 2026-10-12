import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import type { AssertionObservation } from './contract-monitor.js';
import { EventEmitter, makeFailureEvent } from './telemetry.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest: unknown = JSON.parse(
  await readFile(new URL('../build-manifest.json', import.meta.url), 'utf8'),
);
if (
  typeof manifest !== 'object' ||
  manifest === null ||
  !('commit_sha' in manifest) ||
  typeof manifest.commit_sha !== 'string'
)
  throw new Error('Missing build manifest');
const commitSha = manifest.commit_sha;
const logUrl = process.env.TRACEFIX_LOG_URL;
const token = process.env.TRACEFIX_INGESTION_TOKEN;
const emitter = logUrl && token ? new EventEmitter(logUrl, token) : undefined;
const app = createApp({
  onError: (failure) => {
    emitter?.enqueue(
      makeFailureEvent(failure.error, {
        commitSha,
        repositoryRoot: root,
        method: failure.method,
        routeTemplate: failure.routeTemplate,
        requestId: failure.requestId,
        ...(failure.routeTemplate === '/users/:id' ? { fixtureId: 'users-missing' } : {}),
      }),
    );
  },
  onAssertion: (failure: AssertionObservation) => {
    emitter?.enqueue(
      makeFailureEvent(failure.error, {
        commitSha,
        repositoryRoot: root,
        method: failure.method,
        routeTemplate: failure.routeTemplate,
        requestId: failure.requestId,
        fixtureId: failure.fixtureId,
        contractCaseId: failure.contractCaseId,
        kind: 'assertion_failure',
      }),
    );
  },
});
const server = app.listen(Number(process.env.PORT ?? 4312), '127.0.0.1', () => {
  console.log(
    JSON.stringify({
      service: 'demo-api',
      port: Number(process.env.PORT ?? 4312),
      deployed_sha: commitSha,
      telemetry_configured: Boolean(emitter),
    }),
  );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    emitter?.stop();
    server.close();
  });

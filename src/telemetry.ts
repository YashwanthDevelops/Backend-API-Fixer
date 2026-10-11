import { randomUUID } from 'node:crypto';
import { relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FailureEvent {
  schema_version: 1;
  event_id: string;
  occurred_at: string;
  service: string;
  environment: string;
  release: { commit_sha: string };
  request: {
    method: string;
    route_template: string;
    request_id: string;
    fixture_id?: string;
    contract_case_id?: string;
  };
  error: {
    kind: 'exception' | 'assertion_failure';
    name: string;
    message: string;
    frames: { file: string; function?: string; line: number; column?: number }[];
  };
}

export function sourceFrames(
  error: Error,
  repositoryRoot: string,
): FailureEvent['error']['frames'] {
  const frames: FailureEvent['error']['frames'] = [];
  for (const line of (error.stack ?? '').split('\n').slice(1)) {
    const match = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!match?.[2] || !match[3] || !match[4]) continue;
    const path = match[2].startsWith('file:') ? fileURLToPath(match[2]) : match[2];
    const file = relative(repositoryRoot, path).replaceAll('\\', '/');
    if (isAbsolute(file) || !file.startsWith('src/') || file.includes('..')) continue;
    frames.push({
      file,
      ...(match[1] ? { function: match[1] } : {}),
      line: Number(match[3]),
      column: Number(match[4]),
    });
    if (frames.length === 20) break;
  }
  return frames;
}

export function makeFailureEvent(
  error: Error,
  input: {
    commitSha: string;
    repositoryRoot: string;
    method: string;
    routeTemplate: string;
    requestId?: string;
    fixtureId?: string;
  },
): FailureEvent {
  if (!/^[a-f0-9]{40}$/.test(input.commitSha)) throw new Error('Exact deployed Git SHA required');
  return {
    schema_version: 1,
    event_id: randomUUID(),
    occurred_at: new Date().toISOString(),
    service: 'demo-api',
    environment: 'demo',
    release: { commit_sha: input.commitSha },
    request: {
      method: input.method,
      route_template: input.routeTemplate,
      request_id: input.requestId ?? randomUUID(),
      ...(input.fixtureId ? { fixture_id: input.fixtureId } : {}),
    },
    error: {
      kind: 'exception',
      name: error.name,
      message: error.message.slice(0, 2048),
      frames: sourceFrames(error, input.repositoryRoot),
    },
  };
}

export class EventEmitter {
  private readonly pending: FailureEvent[] = [];
  private flushing = false;
  private stopped = false;
  dropped = 0;
  delivered = 0;

  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {}

  enqueue(event: FailureEvent): void {
    if (this.stopped || this.pending.length >= 32) {
      this.dropped += 1;
      return;
    }
    this.pending.push(event);
    // Delivery owns its errors; it never changes the API response or recursively logs.
    void this.flush().catch(() => {
      this.dropped += 1;
    });
  }

  stop(): void {
    this.stopped = true;
    this.pending.length = 0;
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (!this.stopped && this.pending.length) {
        const event = this.pending.shift();
        if (!event) break;
        let accepted = false;
        for (let attempt = 0; attempt < 3 && !this.stopped; attempt += 1) {
          try {
            const result = await fetch(this.endpoint, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${this.token}`,
              },
              body: JSON.stringify(event),
              signal: AbortSignal.timeout(2000),
            });
            accepted = result.status === 202;
            await result.body?.cancel();
            if (accepted || (result.status < 500 && result.status !== 429)) break;
          } catch {
            /* Bounded network failure is counted below; no request data is logged. */
          }
          if (attempt < 2)
            await new Promise<void>((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        }
        if (accepted) this.delivered += 1;
        else this.dropped += 1;
      }
    } finally {
      this.flushing = false;
    }
  }
}

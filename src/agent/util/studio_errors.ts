import { AgentFieldError, AgentValidationProblem } from '../model/agent_studio';

/**
 * Why a Studio mutation answered 409. The backend reports a stale agent revision and a stale
 * type-defaults revision with the same message, so both are `revision`: reload the draft.
 */
export type StudioConflictCause = 'revision' | 'sealed' | 'other';

type ErrorShape = {
  status?: unknown;
  error?: unknown;
  problem?: unknown;
  headers?: { get?: (name: string) => string | null };
  response?: { headers?: { get?: (name: string) => string | null } };
};

function shapeOf(err: unknown): ErrorShape | undefined {
  return err && typeof err === 'object' ? (err as ErrorShape) : undefined;
}

function detailOf(err: unknown): string {
  const shape = shapeOf(err);
  const body = shape?.problem ?? shape?.error;
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object') return '';
  const { detail, message } = body as { detail?: unknown; message?: unknown };
  if (typeof detail === 'string') return detail;
  return typeof message === 'string' ? message : '';
}

export function studioConflictCause(err: unknown): StudioConflictCause | undefined {
  if (shapeOf(err)?.status !== 409) return undefined;
  const detail = detailOf(err);
  if (detail.includes('binding sealed')) return 'sealed';
  if (detail.includes('revision conflict')) return 'revision';
  return 'other';
}

/** Field errors of a 400; the backend carries them as a JSON document in the problem detail. */
export function studioFieldErrors(err: unknown): AgentFieldError[] {
  if (shapeOf(err)?.status !== 400) return [];
  const detail = detailOf(err);
  if (!detail.startsWith('{')) return [];
  try {
    const problem = JSON.parse(detail) as Partial<AgentValidationProblem>;
    return Array.isArray(problem.fields) ? problem.fields : [];
  } catch {
    return [];
  }
}

/** Whole seconds from `Retry-After` on a 429/503; undefined when the server gave no advice. */
export function retryAfterSeconds(err: unknown): number | undefined {
  const shape = shapeOf(err);
  if (shape?.status !== 429 && shape?.status !== 503) return undefined;
  const headers = shape.headers ?? shape.response?.headers;
  const raw = headers?.get?.('Retry-After');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

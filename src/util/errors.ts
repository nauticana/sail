type ProblemShape = { title?: unknown; detail?: unknown; message?: unknown; code?: unknown };

// Structural extraction, not instanceof: bundling can produce two class
// identities for HttpErrorResponse (see api-response.interceptor.ts), so match
// by shape — SailApiError carries `problem`, an HTTP error a numeric `status`
// plus an `error` body.
function problemOf(err: unknown): ProblemShape | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { problem?: unknown; status?: unknown; error?: unknown };
  const body = e.problem ?? (typeof e.status === 'number' && 'error' in e ? e.error : undefined);
  return body && typeof body === 'object' ? (body as ProblemShape) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Human-readable message from any sail error shape — SailApiError (BackendService),
 * raw HttpErrorResponse (direct HttpClient calls), or plain Error.
 */
export function errorDetail(err: unknown, fallback: string): string {
  const problem = problemOf(err);
  if (problem) {
    const message = asString(problem.detail) ?? asString(problem.title) ?? asString(problem.message);
    if (message) return message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

/** Stable machine-readable discriminator from a keel RFC 7807 response. */
export function errorCode(err: unknown): string | undefined {
  return asString(problemOf(err)?.code);
}

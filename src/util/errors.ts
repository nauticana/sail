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

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === 'number' ? s : undefined;
}

/**
 * True when the browser never received a readable response — the network was
 * down, a CORS rule blocked it, or the request was aborted. Angular collapses
 * all three to status 0 with a ProgressEvent body, so this is the only signal
 * available. Use it to offer a retry rather than reporting a backend rejection.
 */
export function isTransportFailure(err: unknown): boolean {
  return statusOf(err) === 0;
}

/**
 * Human-readable message from any sail error shape — SailApiError (BackendService),
 * raw HttpErrorResponse (direct HttpClient calls), or plain Error.
 *
 * keel answers every rejection with an RFC 7807 body, so an error carrying no
 * `detail` did not come from the API: either nothing reached it (status 0) or
 * something in front of it replied with a body we cannot read. Both used to
 * collapse into the caller's fallback, which reads as a backend rejection and
 * hides the real fault; they are now reported distinctly.
 */
export function errorDetail(err: unknown, fallback: string): string {
  if (isTransportFailure(err)) {
    return 'Cannot reach the server — the network or a CORS rule blocked the response.';
  }
  const problem = problemOf(err);
  if (problem) {
    const message = asString(problem.detail) ?? asString(problem.title) ?? asString(problem.message);
    if (message) return message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  const status = statusOf(err);
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

/** Stable machine-readable discriminator from a keel RFC 7807 response. */
export function errorCode(err: unknown): string | undefined {
  return asString(problemOf(err)?.code);
}

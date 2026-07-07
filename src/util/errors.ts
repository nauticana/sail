import { HttpErrorResponse } from '@angular/common/http';
import { SailApiError } from '../service/rest_service';

/**
 * Human-readable message from any sail error shape — SailApiError (BackendService),
 * raw HttpErrorResponse (direct HttpClient calls), or plain Error.
 */
export function errorDetail(err: unknown, fallback: string): string {
  if (err instanceof SailApiError) {
    return err.problem?.detail ?? err.problem?.title ?? err.message ?? fallback;
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { detail?: string; message?: string } | null;
    return body?.detail ?? body?.message ?? fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

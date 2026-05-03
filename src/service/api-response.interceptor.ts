import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, map, throwError } from 'rxjs';

// Detect a final response event by structural shape rather than
// `event instanceof HttpResponse`. Bundling can produce two distinct
// HttpResponse class identities — the one captured inside sail's compiled
// module and the one the host app's HttpClient emits — and instanceof
// then silently returns false. The structural check (presence of `body`
// + a callable `clone` + a successful `status`) is robust to that and
// still correctly skips intermediate events like HttpHeaderResponse and
// HttpProgressEvent.
function isFinalResponse(e: unknown): e is HttpResponse<unknown> {
  if (!e || typeof e !== 'object') return false;
  const r = e as { type?: number; body?: unknown; clone?: unknown; status?: number };
  // HttpEventType.Response === 4. Filtering by type is the most reliable
  // gate (HttpResponse and HttpHeaderResponse have different type values
  // and only HttpResponse carries `body`).
  return r.type === 4
    && 'body' in r
    && typeof r.clone === 'function'
    && typeof r.status === 'number';
}

export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (isFinalResponse(event)) {
        const body = event.body as Record<string, unknown> | null;
        if (body && typeof body === 'object' && 'data' in body) {
          return event.clone({ body: body['data'] });
        }
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) => {
      const detail = error.error?.detail || error.error?.title || error.message;
      return throwError(() => new HttpErrorResponse({
        error: detail,
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      }));
    }),
  );
};

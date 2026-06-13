import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { isKeelUrl } from './rest_url';

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

// Scoped to keel URLs so third-party responses (and their errors) pass through
// untouched. Unwraps keel's `{ data }` envelope; errors are left intact so
// consumers can read the original `HttpErrorResponse.error` (keel's RFC 7807
// ProblemDetail, with `detail` / `title`).
export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isKeelUrl(req.url)) {
    return next(req);
  }
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
  );
};

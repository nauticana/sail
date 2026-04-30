import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, map, throwError } from 'rxjs';

export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (event instanceof HttpResponse) {
        const body = event.body as Record<string, unknown> | null;
        if (body && 'data' in body) {
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

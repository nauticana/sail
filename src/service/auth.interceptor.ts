import { HttpErrorResponse, HttpEvent, HttpEventType, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Observable, catchError, switchMap, tap, throwError } from 'rxjs';
import { isKeelApiUrl } from './rest_url';
import { BaseAuthService, RefreshSupersededError } from './auth.service';

// A 401 on an authed call first tries one refresh-token rotation (keel
// /public/token/refresh) and replays the request with the new JWT; only when
// no refresh token is stored or keel rejects it does the 401 count below.
//
// Auth-loop breaker: repeated 401s on token-bearing API calls (a stale session) can
// drive the app to hammer the API/CDN. After AUTH_FAIL_THRESHOLD within
// AUTH_FAIL_WINDOW_MS the circuit opens for AUTH_CIRCUIT_COOLDOWN_MS — authed
// requests are refused locally. Only 401 counts (403 is a permission denial); a
// success or accepting a new token closes it.
const AUTH_FAIL_WINDOW_MS = 10_000;
const AUTH_FAIL_THRESHOLD = 5;
const AUTH_CIRCUIT_COOLDOWN_MS = 30_000;
const FAIL_KEY = 'keel_auth_401s';
const OPEN_KEY = 'keel_auth_circuit_until';

/** Error-body code carried by the synthetic circuit-open rejection, so
 *  consumers can tell "session expired, request refused locally" apart from a
 *  real 401 and from a network failure (status 0). */
export const AUTH_CIRCUIT_OPEN_CODE = 'sail_auth_circuit_open';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Resolved lazily per event to avoid a DI cycle (BaseAuthService → HttpClient
  // → interceptors) and so an open circuit clears the dead session even when it
  // was opened by a previous page load.
  const injector = inject(Injector);
  const auth = () => injector.get(BaseAuthService, null, { optional: true });
  const expireSession = () => auth()?.sessionExpired();

  const token = localStorage.getItem('jwt');
  const authedApi = !!token && isKeelApiUrl(req.url);
  if (authedApi) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  if (authedApi && authCircuitOpen()) {
    expireSession();
    return throwError(() => new HttpErrorResponse({
      url: req.url,
      status: 401,
      statusText: 'Unauthorized',
      error: {
        code: AUTH_CIRCUIT_OPEN_CODE,
        detail: 'auth circuit open: too many 401s — request stopped to prevent a loop',
      },
    }));
  }

  const countFailure = (err: HttpErrorResponse) => {
    if (recordAuthFailure()) expireSession();
    return throwError(() => err);
  };

  return next(req).pipe(
    tap((event) => {
      if (authedApi && event.type === HttpEventType.Response) {
        clearAuthFailures();
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (!authedApi || err.status !== 401) return throwError(() => err);
      const service = auth();
      if (!service || !localStorage.getItem('refreshToken')) return countFailure(err);
      return service.refreshSession().pipe(
        catchError((refreshErr: unknown) => {
          if (refreshErr instanceof RefreshSupersededError) {
            return throwError(() => err);   // another session took over; it is not ours to expire
          }
          if (refreshErr instanceof HttpErrorResponse && refreshErr.status !== 401) {
            return countFailure(err);       // transient refresh failure: keep the session, count the 401
          }
          expireSession();                  // keel rejected the refresh token: the session is dead
          return throwError(() => err);
        }),
        switchMap((token) => replay(req, next, token)),   // replay errors surface as-is
      );
    }),
  );
};

/** Re-send the request once with the rotated JWT; a second 401 is a real denial. */
function replay(req: HttpRequest<unknown>, next: HttpHandlerFn, token: string): Observable<HttpEvent<unknown>> {
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    tap((event) => { if (event.type === HttpEventType.Response) clearAuthFailures(); }),
  );
}

function authCircuitOpen(): boolean {
  return Date.now() < Number(sessionStorage.getItem(OPEN_KEY) ?? 0);
}

/** Returns true when this failure crossed the threshold and opened the circuit. */
function recordAuthFailure(): boolean {
  const now = Date.now();
  let times: number[];
  try {
    times = (JSON.parse(sessionStorage.getItem(FAIL_KEY) ?? '[]') as number[])
      .filter((t) => now - t < AUTH_FAIL_WINDOW_MS);
  } catch {
    times = [];
  }
  times.push(now);
  if (times.length >= AUTH_FAIL_THRESHOLD) {
    sessionStorage.setItem(OPEN_KEY, String(now + AUTH_CIRCUIT_COOLDOWN_MS));
    sessionStorage.removeItem(FAIL_KEY);
    return true;
  }
  sessionStorage.setItem(FAIL_KEY, JSON.stringify(times));
  return false;
}

function clearAuthFailures(): void {
  sessionStorage.removeItem(FAIL_KEY);
  sessionStorage.removeItem(OPEN_KEY);
}

/** Close the circuit on accepting a new token, so a freshly logged-in session
 *  isn't blocked by failures from a prior stale session. */
export function resetAuthCircuit(): void {
  clearAuthFailures();
}

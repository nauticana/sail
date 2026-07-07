import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { isKeelApiUrl } from './rest_url';
import { BaseAuthService } from './auth.service';

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
  const expireSession = () => injector.get(BaseAuthService, null, { optional: true })?.sessionExpired();

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

  return next(req).pipe(
    tap((event) => {
      if (authedApi && event.type === HttpEventType.Response) {
        clearAuthFailures();
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (authedApi && err.status === 401 && recordAuthFailure()) {
        expireSession();
      }
      return throwError(() => err);
    }),
  );
};

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

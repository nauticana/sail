import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';
import { isKeelApiUrl } from './rest_url';

// Auth-loop breaker: repeated 401/403s on token-bearing API calls (a stale or
// rejected session) can drive the app to hammer the API — and the edge/CDN in
// front of it — indefinitely. After AUTH_FAIL_THRESHOLD failures within
// AUTH_FAIL_WINDOW_MS the circuit opens for AUTH_CIRCUIT_COOLDOWN_MS: authed API
// requests are refused locally (never sent) so the storm stops at the browser. A
// later success closes it; login (no bearer) is never blocked, so recovery works.
const AUTH_FAIL_WINDOW_MS = 10_000;
const AUTH_FAIL_THRESHOLD = 5;
const AUTH_CIRCUIT_COOLDOWN_MS = 30_000;
const FAIL_KEY = 'keel_auth_401s';
const OPEN_KEY = 'keel_auth_circuit_until';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('jwt');
  const authedApi = !!token && isKeelApiUrl(req.url);
  if (authedApi) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  if (authedApi && authCircuitOpen()) {
    return throwError(() => new HttpErrorResponse({
      url: req.url,
      status: 0,
      statusText: 'auth circuit open: too many 401s — request stopped to prevent a loop',
    }));
  }

  return next(req).pipe(
    tap((event) => {
      if (authedApi && event.type === HttpEventType.Response) {
        clearAuthFailures();
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (authedApi && (err.status === 401 || err.status === 403)) {
        recordAuthFailure();
      }
      return throwError(() => err);
    }),
  );
};

function authCircuitOpen(): boolean {
  return Date.now() < Number(sessionStorage.getItem(OPEN_KEY) ?? 0);
}

function recordAuthFailure(): void {
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
  } else {
    sessionStorage.setItem(FAIL_KEY, JSON.stringify(times));
  }
}

function clearAuthFailures(): void {
  sessionStorage.removeItem(FAIL_KEY);
  sessionStorage.removeItem(OPEN_KEY);
}

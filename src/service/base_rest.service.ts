import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RestURL } from './rest_url';

/**
 * Foundation for sail's REST API clients. Owns the shared `http` injection
 * and the `host + path` URL builder so subclasses don't repeat them.
 *
 * Subclasses set `providedIn: 'root'` on their own `@Injectable` decorator
 * (this class itself stays unannotated — Angular resolves it through the
 * subclass).
 */
export abstract class BaseRestService {
  protected readonly http = inject(HttpClient);

  /** Prefix any `RestURL.*URL` path with the configured backend host. */
  protected url(path: string): string {
    return RestURL.httpHost + path;
  }

  /** GET an analytic endpoint (`{host}{api_prefix}analytic/<endpoint>`), returning
   * its rows. Optional flat string params become the query string. */
  protected analytic<T>(endpoint: string, params?: Record<string, string>): Observable<T[]> {
    return this.http.get<T[]>(this.analyticUrl(endpoint), { params: this.analyticParams(params) });
  }

  /** `analytic()` plus the `X-Data-Source-Status` / `X-Data-Source` response headers, so an
   * empty result can be told apart from a missing source. `analytic()` stays array-valued. */
  protected analyticWithStatus<T>(endpoint: string, params?: Record<string, string>): Observable<AnalyticResult<T>> {
    return this.http.get<T[]>(this.analyticUrl(endpoint), {
      params: this.analyticParams(params),
      observe: 'response',
    }).pipe(
      map((response) => ({
        rows: response.body ?? [],
        source: {
          status: response.headers.get('X-Data-Source-Status'),
          id: response.headers.get('X-Data-Source'),
        },
      })),
    );
  }

  private analyticUrl(endpoint: string): string {
    return this.url(RestURL.api_prefix + 'analytic/' + endpoint);
  }

  private analyticParams(params?: Record<string, string>): HttpParams {
    let result = new HttpParams();
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) result = result.set(key, params[key]);
    }
    return result;
  }
}

export interface AnalyticResult<T> {
  rows: T[];
  source: AnalyticSourceStatus;
}

export interface AnalyticSourceStatus {
  status: string | null;
  id: string | null;
}

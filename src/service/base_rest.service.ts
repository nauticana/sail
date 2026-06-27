import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
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
    let p = new HttpParams();
    for (const k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) p = p.set(k, params[k]);
    }
    return this.http.get<T[]>(this.url(RestURL.api_prefix + 'analytic/' + endpoint), { params: p });
  }
}

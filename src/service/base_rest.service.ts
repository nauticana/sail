import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
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
}

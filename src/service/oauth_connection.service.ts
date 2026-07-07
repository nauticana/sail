import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { PartnerCredential } from '../model/oauth_connection';

/**
 * OAuthConnectionService — frontend client for keel oauth/connect.
 *
 * OAuth flow endpoints live under /api/oauth/*; the stored connection rows are
 * read/removed through the generic REST `partner_credential` API. entityId (0 =
 * tenant-wide, >0 = a specific business) scopes per-entity connections.
 */
@Injectable({ providedIn: 'root' })
export class OAuthConnectionService extends BaseRestService {
  private readonly backend = inject(BackendService);
  private readonly crudApi = 'partner_credential';

  /** Start an OAuth connect flow; resolves to the provider consent URL to redirect to. */
  startOAuth(provider: string, extra: Record<string, string> = {}): Observable<string> {
    const qs = new URLSearchParams(extra).toString();
    const path = `/api/oauth/${encodeURIComponent(provider)}/authorize${qs ? '?' + qs : ''}`;
    return this.http.get<{ url: string }>(this.url(path)).pipe(map((r) => r.url));
  }

  /** Re-validate a stored connection (POST — it makes an outbound call and updates
   * status). entityId selects which one (0 = tenant-wide). */
  testConnection(provider: string, entityId = 0): Observable<{ status: string; message?: string }> {
    return this.http.post<{ status: string; message?: string }>(
      this.url(`/api/oauth/${encodeURIComponent(provider)}/test?entity_id=${entityId}`),
      {},
    );
  }

  /** The partner's stored connections for one entity scope (0 = tenant-wide).
   * Filters by entity so the panel never shows another business's connections. */
  list(entityId = 0): Observable<PartnerCredential[]> {
    return this.backend.list<PartnerCredential>(this.crudApi, { EntityId: String(entityId) });
  }

  /** Remove a stored connection by id. */
  disconnect(id: number): Observable<{ message: string }> {
    return this.backend.delete(this.crudApi, { Id: String(id) });
  }

  /** Save an API-key connection (sealed server-side by the connect handler). */
  saveApiKey(provider: string, credRef: string, apiEndpoint = '', entityId = 0): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url('/api/oauth/apikey'), {
      provider,
      cred_ref: credRef,
      api_endpoint: apiEndpoint,
      entity_id: entityId,
    });
  }
}

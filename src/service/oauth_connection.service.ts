import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { PartnerCredential } from '../model/oauth_connection';
import { Int64 } from '../util/integer';

/**
 * OAuthConnectionService — frontend client for keel oauth/connect.
 *
 * Flow and write endpoints live under /api/oauth/*; stored connection rows are
 * listed through the generic REST `partner_credential` API. entityId (0 =
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

  /** Finish an OAuth connect flow: redeem the single-use callback ticket keel put
   * in `?connect=<provider>&ticket=...` for the signed-in user who started it.
   * 400 = expired or spent ticket; 403 = started by another user or partner. */
  completeOAuth(provider: string, ticket: string): Observable<{ status: string; provider: string }> {
    return this.http.post<{ status: string; provider: string }>(
      this.url(`/api/oauth/${encodeURIComponent(provider)}/complete`),
      { ticket },
    );
  }

  /** Re-validate a stored connection (POST — it makes an outbound call and updates
   * status). entityId selects which one (0 = tenant-wide). */
  testConnection(provider: string, entityId: Int64 = '0'): Observable<{ status: string; message?: string }> {
    return this.http.post<{ status: string; message?: string }>(
      this.url(`/api/oauth/${encodeURIComponent(provider)}/test?entity_id=${encodeURIComponent(entityId)}`),
      {},
    );
  }

  /** The partner's stored connections for one entity scope (0 = tenant-wide).
   * Filters by entity so the panel never shows another business's connections. */
  list(entityId: Int64 = '0'): Observable<PartnerCredential[]> {
    return this.backend.list<PartnerCredential>(this.crudApi, { EntityId: entityId });
  }

  /** Remove the partner's connection to a provider in one entity scope. */
  disconnect(provider: string, entityId: Int64 = '0'): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url('/api/oauth/disconnect'), { provider, entity_id: entityId });
  }

  /** Save an API-key connection (sealed server-side by the connect handler). */
  saveApiKey(provider: string, credRef: string, apiEndpoint = '', entityId: Int64 = '0'): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url('/api/oauth/apikey'), {
      provider,
      cred_ref: credRef,
      api_endpoint: apiEndpoint,
      entity_id: entityId,
    });
  }
}

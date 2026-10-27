import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { ApiKey, MintedApiKey, NewApiKey, OAuthGrant } from '../model/access';
import { TableAction } from '../model/appdata';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { Int64 } from '../util/integer';

/** The signed-in user's API keys (keel `api_key` table and actions) and OAuth grants. */
@Injectable({ providedIn: 'root' })
export class AccessService extends BackendService {
  apiKeys(): Observable<ApiKey[]> {
    return this.list<ApiKey>('api_key', undefined, { orderBy: 'created_at desc' });
  }

  mintApiKey(key: NewApiKey): Observable<MintedApiKey> {
    return this.apiKeyAction<MintedApiKey>('generate', key);
  }

  restrictApiKey(id: Int64, allowedCidrs: string): Observable<void> {
    return this.apiKeyAction<void>('restrict', { id, allowed_cidrs: allowedCidrs });
  }

  revokeApiKey(id: Int64): Observable<{ message: string }> {
    return this.delete('api_key', { Id: id });
  }

  grants(): Observable<OAuthGrant[]> {
    return this.http.get<OAuthGrant[]>(this.url(RestURL.oauthGrantsURL))
      .pipe(catchError((err) => this.handleError(err)));
  }

  revokeGrant(clientId: string): Observable<void> {
    return this.http.post<void>(this.url(RestURL.oauthGrantRevokeURL), { clientId })
      .pipe(catchError((err) => this.handleError(err)));
  }

  canApiKeyAction(name: string): boolean {
    const action = this.findApiKeyAction(name);
    return !!action && this.auth.canExecute(action.authorityObject, action.authorityCheck, 'api_key');
  }

  canRevokeApiKey(): boolean {
    return this.auth.canDelete('api_key');
  }

  private apiKeyAction<T>(name: string, body: Record<string, unknown>): Observable<T> {
    const action = this.findApiKeyAction(name);
    return action
      ? this.executeAction<T>(action.method, body)
      : throwError(() => new Error(`sail: api_key/${name} is not available in backend metadata.`));
  }

  private findApiKeyAction(name: string): TableAction | undefined {
    return (this.auth.getTableDefinition('api_key')?.Actions ?? []).find((action) => action.action === name);
  }
}

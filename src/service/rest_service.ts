import { HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, throwError } from "rxjs";
import { PaginatedList } from "../model/appdata";
import { RestURL } from "./rest_url";
import { BaseAuthService } from "./auth.service";
import { BaseRestService } from "./base_rest.service";

@Injectable({providedIn: 'root'})
export class BackendService extends BaseRestService {
    private readonly auth = inject(BaseAuthService);
    protected readonly prefix = this.url(RestURL.api_prefix);

    protected handleError(error: HttpErrorResponse) {
        if (error.status === 0) {
            console.error('an error occurred', error.error);
        } else {
            console.error(`backend return error code: ${error.status} error body: ${error.error}`);
        }
        return throwError(() => 'error occurred, see console log and try again');
    }

    /** Free-form path under the API base — for custom endpoints (e.g. `rides/start`). CRUD methods use `crudUrl` instead. */
    protected apiUrl(path: string): string {
        const trimmed = path.startsWith('/') ? path.slice(1) : path;
        return this.prefix + trimmed;
    }

    /** CRUD URL versioned from the backend (Apis[apiName].Version); throws rather than assume a version. */
    private crudUrl(apiName: string, action: string): string {
        const version = this.auth.getApiDictionary(apiName)?.Version;
        if (!version) {
            throw new Error(`sail: no backend version for API "${apiName}"; refusing to assume one.`);
        }
        return `${this.prefix}${version}/${apiName}/${action}`;
    }

    /**
     * Generic typed HTTP request for endpoints that don't fit the
     * list/get/post/delete pattern. Subclasses use this for
     * domain-specific actions.
     */
    protected request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Observable<T> {
        return this.http.request<T>(method, this.apiUrl(path), { body }).pipe(catchError(this.handleError));
    }

    /** Build query params from a flat string-string map; skips undefined/null. */
    private toParams(filter?: {[key: string]: string}): HttpParams {
        let params = new HttpParams();
        if (!filter) return params;
        for (const key in filter) {
            if (Object.prototype.hasOwnProperty.call(filter, key)) {
                params = params.set(key, filter[key]);
            }
        }
        return params;
    }

    /** Unwraps `{items, limit, offset, total}` to the items array. Pass `_limit` / `_offset` in `filter` to control paging (defaults: 100 / 0). */
    list<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T[]> {
        return this.listPaginated<T>(apiName, filter).pipe(map((page) => page.items));
    }

    listPaginated<T>(apiName: string, filter?: {[key: string]: string}) : Observable<PaginatedList<T>> {
        return this.http.get<PaginatedList<T>>(
            this.crudUrl(apiName, 'list'),
            {params: this.toParams(filter)},
        ).pipe(catchError(this.handleError));
    }

    get<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T> {
        return this.http.get<T>(this.crudUrl(apiName, 'get'), {params: this.toParams(filter)}).pipe(catchError(this.handleError));
    }

    post<T>(apiName: string, items: T | T[]) : Observable<{message: string}> {
        return this.http.post<{message: string}>(this.crudUrl(apiName, 'post'), items).pipe(catchError(this.handleError));
    }

    delete(apiName: string, filter?: {[key: string]: string}): Observable<{message: string}> {
        return this.http.delete<{message: string}>(this.crudUrl(apiName, 'delete'), {params: this.toParams(filter)}).pipe(catchError(this.handleError));
    }

    /**
     * Fire a TableAction button. `actionPath` is the resolved URL path
     * the keel REST engine pre-computed onto TableAction.method
     * (e.g. "/user_payment_method/set_default"); pass it verbatim and
     * the call will POST to {host}{api_prefix}{actionPath} with the
     * supplied body. For record-specific actions the body carries the
     * primary key values; for table-level actions it is typically `{}`.
     */
    executeAction<T = unknown>(actionPath: string, body: Record<string, unknown> = {}): Observable<T> {
        return this.http.post<T>(this.apiUrl(actionPath), body).pipe(catchError(this.handleError));
    }
}

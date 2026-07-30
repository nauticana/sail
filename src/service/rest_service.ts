import { HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, switchMap, take, throwError } from "rxjs";
import { ApplicationData, PaginatedList } from "../model/appdata";
import { RestURL } from "./rest_url";
import { BaseAuthService } from "./auth.service";
import { BaseRestService } from "./base_rest.service";

/** keel's RFC 7807 error body (WriteError) — surfaced verbatim on SailApiError. */
export interface ProblemDetail {
    title?: string;
    detail?: string;
    status?: number;
    code?: string;
    [key: string]: unknown;
}

/**
 * Typed error thrown by BackendService CRUD calls. Preserves the HTTP status
 * and keel's ProblemDetail so consumers can branch on status codes and show
 * field-level validation messages instead of a generic string.
 */
export class SailApiError extends Error {
    readonly status: number;
    readonly problem?: ProblemDetail;
    readonly response: HttpErrorResponse;

    constructor(response: HttpErrorResponse) {
        const problem = (response.error && typeof response.error === 'object')
            ? response.error as ProblemDetail
            : undefined;
        super(problem?.detail ?? problem?.title ?? response.message);
        this.name = 'SailApiError';
        this.status = response.status;
        this.problem = problem;
        this.response = response;
    }
}

@Injectable({providedIn: 'root'})
export class BackendService extends BaseRestService {
    private readonly auth = inject(BaseAuthService);

    /** Resolved per call so configureRestUrls() may run any time before the first request. */
    protected get prefix(): string {
        return this.url(RestURL.api_prefix);
    }

    protected handleError(error: unknown): Observable<never> {
        if (!(error instanceof HttpErrorResponse)) {
            // e.g. crudUrl's missing-version Error — already descriptive, pass through.
            return throwError(() => error);
        }
        if (error.status === 0) {
            console.error('an error occurred', error.error);
        } else {
            console.error(`backend returned error code ${error.status}`, error.error);
        }
        return throwError(() => new SailApiError(error));
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
        return this.http.request<T>(method, this.apiUrl(path), { body }).pipe(catchError((err) => this.handleError(err)));
    }

    /** Build query params from a flat string-string map; skips undefined/null values. */
    private toParams(filter?: {[key: string]: string}): HttpParams {
        let params = new HttpParams();
        if (!filter) return params;
        for (const key in filter) {
            if (Object.prototype.hasOwnProperty.call(filter, key) && filter[key] != null) {
                params = params.set(key, filter[key]);
            }
        }
        return params;
    }

    /** Gates a CRUD call on appdata being loaded — `appData$` is a ReplaySubject(1) so this resolves synchronously once the cache is populated, and blocks the call (instead of throwing) while loadAppData() is in flight. A failed appdata load errors through here, so gated calls fail loudly instead of hanging. */
    private appDataReady(): Observable<ApplicationData> {
        return this.auth.getAppData().pipe(take(1));
    }

    /** Unwraps `{items, limit, offset, total}` to the items array. Pass `_limit` / `_offset` in `filter` to control paging (defaults: 100 / 0). */
    list<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T[]> {
        return this.listPaginated<T>(apiName, filter).pipe(map((page) => page.items));
    }

    listPaginated<T>(apiName: string, filter?: {[key: string]: string}) : Observable<PaginatedList<T>> {
        return this.appDataReady().pipe(
            switchMap(() => this.http.get<PaginatedList<T>>(
                this.crudUrl(apiName, 'list'),
                {params: this.toParams(filter)},
            )),
            catchError((err) => this.handleError(err)),
        );
    }

    get<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T> {
        return this.appDataReady().pipe(
            switchMap(() => this.http.get<T>(this.crudUrl(apiName, 'get'), {params: this.toParams(filter)})),
            catchError((err) => this.handleError(err)),
        );
    }

    post<T>(apiName: string, items: T | T[]) : Observable<{message: string}> {
        return this.appDataReady().pipe(
            switchMap(() => this.http.post<{message: string}>(this.crudUrl(apiName, 'post'), items)),
            catchError((err) => this.handleError(err)),
        );
    }

    delete(apiName: string, filter?: {[key: string]: string}): Observable<{message: string}> {
        return this.appDataReady().pipe(
            switchMap(() => this.http.delete<{message: string}>(this.crudUrl(apiName, 'delete'), {params: this.toParams(filter)})),
            catchError((err) => this.handleError(err)),
        );
    }

    /** GET a report endpoint (`{host}{api_prefix}{apiPath}`) — rows for TableReport. */
    report<T = Record<string, unknown>>(apiPath: string, params?: {[key: string]: string}): Observable<T[]> {
        return this.http.get<T[]>(this.apiUrl(apiPath), { params: this.toParams(params) })
            .pipe(catchError((err) => this.handleError(err)));
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
        return this.http.post<T>(this.apiUrl(actionPath), body).pipe(catchError((err) => this.handleError(err)));
    }
}

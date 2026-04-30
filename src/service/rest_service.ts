import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, throwError } from "rxjs";
import { PaginatedList } from "../model/appdata";
import { RestURL } from "./rest_url";

@Injectable({providedIn: 'root'})
export class BackendService {
    protected readonly prefix = RestURL.httpHost + RestURL.api_prefix;
    protected readonly http = inject(HttpClient);

    protected handleError(error: HttpErrorResponse) {
        if (error.status === 0) {
            console.error('an error occurred', error.error);
        } else {
            console.error(`backend return error code: ${error.status} error body: ${error.error}`);
        }
        return throwError(() => 'error occurred, see console log and try again');
    }

    /**
     * Build a fully-qualified URL under the configured API base. Use for
     * endpoints that don't fit the metadata-driven `/api/{name}/{op}`
     * shape — e.g. domain-specific actions like `rides/start`. Strips any
     * leading slash on `path` so callers can pass either form.
     *
     * For metadata-driven CRUD use list/get/post/delete instead — they
     * already build the URL.
     */
    protected apiUrl(path: string): string {
        const trimmed = path.startsWith('/') ? path.slice(1) : path;
        return this.prefix + trimmed;
    }

    /**
     * Generic typed HTTP request for endpoints that don't fit the
     * list/get/post/delete pattern. Subclasses use this for
     * domain-specific actions:
     *
     *   class RideService extends BackendService {
     *     startRide(req: StartRideReq) {
     *       return this.request<RideResponse>('POST', 'rides/start', req);
     *     }
     *   }
     *
     * Errors are routed through handleError so callers see the same
     * "see console log and try again" envelope as CRUD methods.
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

    /**
     * keel list endpoints return `{items, limit, offset, total}`. This method
     * unwraps to the array — most callers only need the records. Use
     * `listPaginated()` to access the total + offset. Pass `_limit` / `_offset`
     * in `filter` to control paging (defaults: 100 / 0).
     */
    list<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T[]> {
        return this.listPaginated<T>(apiName, filter).pipe(map((page) => page.items));
    }

    /** Paginated list — returns `{items, limit, offset, total}`. */
    listPaginated<T>(apiName: string, filter?: {[key: string]: string}) : Observable<PaginatedList<T>> {
        return this.http.get<PaginatedList<T>>(
            this.apiUrl(apiName + '/list'),
            {params: this.toParams(filter)},
        ).pipe(catchError(this.handleError));
    }

    get<T>(apiName: string, filter?: {[key: string]: string}) : Observable<T> {
        return this.http.get<T>(this.apiUrl(apiName + '/get'), {params: this.toParams(filter)}).pipe(catchError(this.handleError));
    }

    post<T>(apiName: string, items: T | T[]) : Observable<{message: string}> {
        return this.http.post<{message: string}>(this.apiUrl(apiName + '/post'), items).pipe(catchError(this.handleError));
    }

    delete(apiName: string, filter?: {[key: string]: string}): Observable<{message: string}> {
        return this.http.delete<{message: string}>(this.apiUrl(apiName + '/delete'), {params: this.toParams(filter)}).pipe(catchError(this.handleError));
    }
}

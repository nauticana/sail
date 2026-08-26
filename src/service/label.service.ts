import { inject, Injectable } from "@angular/core";
import { Observable, map, of, shareReplay, take, tap } from "rxjs";
import { BaseAuthService } from "./auth.service";

@Injectable({ providedIn: 'root' })
export class LabelService {
    private readonly auth = inject(BaseAuthService);
    protected labels: Map<string, Map<string, string>> = new Map();
    private readonly pendingLoads = new Map<string, Observable<void>>();

    /** Return a caption from a constant domain, falling back visibly to its raw value. */
    getLabel(constantId: string, key: string): string {
        return this.labels.get(constantId)?.get(key) ?? key;
    }

    /**
     * Load one backend-provided `constant_value` domain from ApplicationData.
     * Completed and concurrent requests are cached; a failed application-data
     * load is evicted so a later call can retry.
     */
    loadLabels(constantId: string): Observable<void> {
        const domain = constantId.trim();
        if (!domain) throw new Error('sail: a constant id is required to load labels.');
        if (this.labels.has(domain)) return of(undefined);

        const pending = this.pendingLoads.get(domain);
        if (pending) return pending;

        const request = this.auth.getAppData().pipe(
            take(1),
            tap({
                next: (data) => this.labels.set(
                    domain,
                    new Map(Object.entries(data.ConstantCache?.[domain] ?? {})),
                ),
                error: () => this.pendingLoads.delete(domain),
            }),
            map(() => undefined),
            shareReplay({ bufferSize: 1, refCount: false }),
        );
        this.pendingLoads.set(domain, request);
        return request;
    }
}

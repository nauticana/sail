import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, linkedSignal, OnInit, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ActivatedRoute, Router } from "@angular/router";
import { take } from "rxjs";
import { BaseForm } from "../abstract/base_form";
import { RecordForm } from "../form/form_record";
import { ApplicationMenu } from "../../model/common";

@Component({
    selector: 'sail-table-search',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './table_search.html',
    imports: [
        MatButtonModule,
        MatIconModule,
        RecordForm,
    ],
})
export class TableSearch extends BaseForm implements OnInit {
    readonly tableNameInput   = input('', { alias: 'tableName' });
    readonly apiNameInput     = input('', { alias: 'apiName' });
    readonly targetRouteInput = input('', { alias: 'targetRoute' });

    override readonly tableName  = linkedSignal<string, string>({ source: () => this.tableNameInput(),   computation: (v, p) => v || p?.value || '' });
    readonly apiName              = linkedSignal<string, string>({ source: () => this.apiNameInput(),     computation: (v, p) => v || p?.value || '' });
    readonly targetRoute          = linkedSignal<string, string>({ source: () => this.targetRouteInput(), computation: (v, p) => v || p?.value || '' });

    readonly searchColumns = computed<string[]>(() => {
        this.cacheService.appDataVersion();
        this.tableName();
        return this.getDisplayedColumns();
    });

    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Search screen surfaces only table-level actions; record-specific actions
     * never appear here (no row context). `executeAction()` is inherited from
     * BaseTable; no per-screen refresh needed since search has no row list.
     */

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName() && data['tableName']) this.tableName.set(data['tableName']);
        if (!this.apiName() && data['apiName']) this.apiName.set(data['apiName']);
        if (!this.targetRoute() && data['targetRoute']) this.targetRoute.set(data['targetRoute']);
        this.title.set(this.getCaption() + ' Search');
        if (!this.targetRoute() && (this.apiName() || this.tableName())) {
            this.cacheService.getMenus().pipe(
                take(1),
                takeUntilDestroyed(this.destroyRef),
            ).subscribe((menus: ApplicationMenu[]) => this.resolveTargetRoute(menus));
        }
        this.editableRecord.set(this.emptySearchRecord());
    }

    /** Exact RestUri match only — substring matching routed `user` to `user_payment_method`. */
    private resolveTargetRoute(menus: ApplicationMenu[]) {
        const apiName = this.apiName();
        const tableName = this.tableName();
        for (const menu of menus) {
            if (!menu.Id) continue;
            for (const page of menu.ApplicationMenuItems ?? []) {
                if (!page.ItemId || !page.RestUri) continue;
                if (page.RestUri === apiName || (!apiName && tableName && page.RestUri === tableName)) {
                    const base = '/' + menu.Id.toLowerCase() + '/' + page.ItemId;
                    this.targetRoute.set(page.FilterOnList ? base : base + '/list');
                    return;
                }
            }
        }
    }

    onSearch() {
        const targetRoute = this.targetRoute();
        if (!targetRoute) {
            alert('Navigation target not found for this table');
            return;
        }
        this.router.navigate([targetRoute], {queryParams: this.buildSearchTerms(this.editableRecord())});
    }

    onClear() {
        this.editableRecord.set(this.emptySearchRecord());
    }

    /**
     * emptyRecord() with every seeded default blanked (booleans to null), so an
     * unmodified Search never ships implicit filters like `?Status=A`.
     * buildSearchTerms skips null/'' — only user-set values reach the URL.
     */
    private emptySearchRecord(): Record<string, unknown> {
        const rec = this.emptyRecord();
        for (const key of Object.keys(rec)) {
            if (key === this.config.opField || Array.isArray(rec[key])) continue;
            rec[key] = this.isBoolean(key) ? null : '';
        }
        return rec;
    }

    onAddRecord() {
        if (!this.requireAuth(() => this.canCreate(), 'create')) return;
        const targetRoute = this.targetRoute();
        if (!targetRoute) {
            alert('Navigation target not found for this table');
            return;
        }
        this.router.navigate([targetRoute], {queryParams: {'_action': 'create'}});
    }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params } from "@angular/router";
import { BaseView } from "../abstract/base_view";
import { TableEdit } from "./table_edit";
import { BackendService } from "../../service/rest_service";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";

@Component({
    selector: 'table-list',
    templateUrl: './table_list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonModule, MatCheckboxModule, MatIconModule],
})
export class TableList extends BaseView implements OnInit {
    override dialogWidth = '400px';

    private readonly route = inject(ActivatedRoute);
    private readonly backendService = inject(BackendService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly destroyRef = inject(DestroyRef);

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName && data['tableName']) this.tableName = data['tableName'];
        if (!this.apiName && data['apiName']) this.apiName = data['apiName'];
        if (!this.dialogComponent) this.dialogComponent = data['dialogComponent'] ?? TableEdit;
        this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.handleQueryParams(params));
    }

    protected handleDelete(record: {[key: string]: any}): void {
        if (!this.canDelete()) {
            alert('Missing authorization to delete records');
            return;
        }
        if (confirm('Are you sure you want to delete this record?')) {
            const keyFilter = this.getKeyFilters(record);
            this.backendService.delete(this.apiName, keyFilter).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => console.error('Delete failed', err),
            });
        }
    }

    protected handleUpdate(result: {[key: string]: any}, isNew: boolean, _original: {[key: string]: any}): void {
        if (isNew && !this.canCreate()) {
            alert('Missing authorization to create records');
            return;
        }
        if (!isNew && !this.canUpdate()) {
            alert('Missing authorization to update records');
            return;
        }
        if (confirm('Are you sure you want to save this record?')) {
            this.backendService.post(this.apiName, result).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => console.error('Save failed', err),
            });
        }
    }

    fetchRecords() {
        if (!this.canRead()) {
            alert('Missing authorization to read records');
            return;
        }
        this.backendService.list<{[key: string]: any}>(this.apiName, this.searchTerms).subscribe({
            next: (records) => {
                this.records = records;
                this.updateDisplayedColumns(records);
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Fetch failed', err),
        });
    }

    handleQueryParams(params: Params) {
        const newSearchTerms: {[key: string]: string} = {};
        let hasSearchTerms = false;
        let action = '';
        for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                if (key === '_action') {
                    action = params[key];
                } else {
                    newSearchTerms[key] = params[key];
                    hasSearchTerms = true;
                }
            }
        }
        if (hasSearchTerms) this.searchTerms = newSearchTerms;
        this.fetchRecords();
        if (action === 'create') {
            setTimeout(() => this.addRecord(), 500);
        }
    }
}

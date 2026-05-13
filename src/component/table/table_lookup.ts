import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { RecordForm } from "../form/form_record";
import { BaseView } from "../abstract/base_view";

@Component({
    selector: 'sail-table-lookup',
    templateUrl: './table_lookup.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
        RecordForm,
    ],
})
export class TableLookup extends BaseView implements OnInit {
    searchRecord: any = {};
    searchColumns: string[] = [];

    private readonly dialogRef = inject(MatDialogRef<TableLookup>);
    private readonly data = inject<{tableName?: string; apiName?: string}>(MAT_DIALOG_DATA);
    protected readonly cdr = inject(ChangeDetectorRef);

    ngOnInit() {
        if (this.data) {
            this.tableName.set(this.data.tableName ?? '');
            this.apiName.set(this.data.apiName   ?? '');
        }
        this.searchColumns = this.getDisplayedColumns();
        this.searchRecord  = this.emptyRecord();
        this.resolveApi();
    }

    private resolveApi() {
        const tableName = this.tableName();
        if (!this.apiName() && tableName) {
            this.cacheService.getAppData().subscribe((data) => {
                if (data.Apis) {
                    for (const api in data.Apis) {
                        const entry = data.Apis[api];
                        if (entry.Table.TableName === tableName) {
                            this.apiName.set(entry.Version ? entry.Version + '/' + api : api);
                            break;
                        }
                    }
                }
            });
        }
    }

    onSearch() {
        this.resolveApi();
        const apiName = this.apiName();
        if (!apiName) {
            console.error('API name not found for table ' + this.tableName());
            return;
        }
        this.backendService.list<{[key: string]: any}>(apiName, this.buildSearchTerms(this.searchRecord)).subscribe({
            next: (records) => {
                this.records = records;
                this.updateDisplayedColumns(records);
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Lookup search failed', err),
        });
    }

    onSelect(record: any) {
        this.dialogRef.close(record);
    }

    onClear() {
        this.searchRecord = this.emptyRecord();
        this.records = [];
    }

    protected handleDelete(_record: {[key: string]: any}): void {}

    protected handleUpdate(_result: {[key: string]: any}, _isNew: boolean, _original: {[key: string]: any}): void {}
}

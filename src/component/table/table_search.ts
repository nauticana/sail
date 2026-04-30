import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { ActivatedRoute, Router } from "@angular/router";
import { BaseForm } from "../abstract/base_form";
import { RecordForm } from "../form/form_record";
import { ApplicationMenu } from "../../model/common";

@Component({
    selector: 'table-search',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './table_search.html',
    imports: [
        MatButtonModule,
        RecordForm,
    ],
})
export class TableSearch extends BaseForm implements OnInit {
    @Input() override tableName = '';
    @Input() apiName: string = '';
    @Input() targetRoute: string = '';
    searchColumns: string[] = [];

    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName && data['tableName']) this.tableName = data['tableName'];
        if (!this.apiName && data['apiName']) this.apiName = data['apiName'];
        if (!this.targetRoute && data['targetRoute']) this.targetRoute = data['targetRoute'];
        this.title = this.getCaption() + ' Search';
        if (!this.targetRoute && (this.apiName || this.tableName)) {
            this.cacheService.getMenus().subscribe((menus: ApplicationMenu[]) => {
                for (const menu of menus) {
                    for (const page of menu.ApplicationMenuItems!) {
                        if (this.apiName.endsWith(page.RestUri!) ||
                            (this.tableName && page.RestUri!.includes(this.tableName))
                        ) {
                            if (page.FilterOnList) {
                                this.targetRoute = '/' + menu.Id!.toLowerCase() + '/' + page.ItemId!;
                            } else {
                                this.targetRoute = '/' + menu.Id!.toLowerCase() + '/' + page.ItemId! + '/list';
                            }
                            this.cdr.markForCheck();
                            return;
                        }
                    }
                }
            });
        }
        this.editableRecord = this.emptyRecord();
        this.searchColumns = this.getDisplayedColumns();
    }

    onSearch() {
        if (!this.targetRoute) {
            alert('Navigation target not found for this table');
            return;
        }
        this.router.navigate([this.targetRoute], {queryParams: this.buildSearchTerms(this.editableRecord)});
    }

    onClear() {
        this.editableRecord = this.emptyRecord();
    }

    onAddRecord() {
        if (!this.canCreate()) {
            alert('Missing authorization to create records');
            return;
        }
        if (!this.targetRoute) {
            alert('Navigation target not found for this table');
            return;
        }
        this.router.navigate([this.targetRoute], {queryParams: {'_action': 'create'}});
    }
}

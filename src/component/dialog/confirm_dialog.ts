import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

export interface ConfirmOptions {
    title: string;
    message?: string;
    /** Label of the confirming button, e.g. "Delete record". */
    action: string;
    /** Styles the action with the global `.warn` class. */
    destructive?: boolean;
}

/** Material confirmation opened by `PromptService`; closes with true only on the action. */
@Component({
    selector: 'sail-confirm-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule],
    template: `
        <h2 mat-dialog-title>{{ data.title }}</h2>
        @if (data.message) { <mat-dialog-content><p>{{ data.message }}</p></mat-dialog-content> }
        <mat-dialog-actions align="end">
            <button matButton type="button" mat-dialog-close>Cancel</button>
            <button matButton="filled" type="button" [class.warn]="data.destructive" [mat-dialog-close]="true">{{ data.action }}</button>
        </mat-dialog-actions>`,
})
export class ConfirmDialog {
    protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

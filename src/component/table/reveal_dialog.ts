import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { Clipboard } from "@angular/cdk/clipboard";

/** Shows the one-time secret a kind:'V' reveal action returned (e.g. a minted API key), with copy buttons. */
@Component({
    selector: "sail-reveal-dialog",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule, MatIconModule],
    templateUrl: "./reveal_dialog.html",
})
export class RevealDialog {
    private readonly clipboard = inject(Clipboard);
    readonly entries = Object.entries(inject<Record<string, unknown>>(MAT_DIALOG_DATA))
        .filter(([, v]) => typeof v === "string" && v.length > 0) as [string, string][];

    copy(value: string): void {
        this.clipboard.copy(value);
    }
}

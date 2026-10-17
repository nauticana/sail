import { inject, Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { map, Observable } from "rxjs";
import { ConfirmDialog, ConfirmOptions } from "../component/dialog/confirm_dialog";

/** Shared confirmation and failure notice, in place of native confirm() and alert(). */
@Injectable({ providedIn: 'root' })
export class PromptService {
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);

    /** Emits true when the action was chosen; false on Cancel, Escape, or backdrop. */
    confirm(options: ConfirmOptions): Observable<boolean> {
        return this.dialog.open(ConfirmDialog, { data: options, role: 'alertdialog', width: '400px' })
            .afterClosed().pipe(map((result) => result === true));
    }

    /** Runs `then` once, only when the action was chosen. */
    ask(options: ConfirmOptions, then: () => void): void {
        this.confirm(options).subscribe((ok) => { if (ok) then(); });
    }

    notify(message: string): void {
        this.snack.open(message, 'Dismiss', { politeness: 'assertive' });
    }
}

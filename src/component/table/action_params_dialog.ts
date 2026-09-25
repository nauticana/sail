import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { TableAction, TableActionParameter } from "../../model/appdata";
import { ConstantValue } from "../../model/common";
import { BaseAuthService } from "../../service/auth.service";

type ParamKind = 'checkbox' | 'number' | 'date' | 'datetime-local' | 'text';

interface ParamField {
    param:    TableActionParameter;
    kind:     ParamKind | 'select';
    /** From dataType; a lookup dropdown still posts a number when the column is numeric. */
    wireKind: ParamKind;
    options?: ConstantValue[];
}

/** Collects a table action's declared parameters; closes with the typed values, or undefined on cancel. */
@Component({
    selector: "sail-action-params-dialog",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: "./action_params_dialog.html",
})
export class ActionParamsDialog {
    private readonly auth = inject(BaseAuthService);
    private readonly dialogRef = inject(MatDialogRef<ActionParamsDialog, Record<string, unknown>>);
    readonly action = inject<TableAction>(MAT_DIALOG_DATA);

    readonly fields: ParamField[] = (this.action.parameters ?? []).map((param) => {
        const options = param.lookupTable ? this.auth.getTableValues(param.lookupTable) : undefined;
        const wireKind = kindOf(param.dataType);
        return { param, kind: options ? 'select' : wireKind, wireKind, options };
    });

    readonly form = new FormGroup(Object.fromEntries(this.fields.map((f) => {
        const validators: ValidatorFn[] = f.param.required && f.kind !== 'checkbox' ? [Validators.required] : [];
        const initial: unknown = f.kind === 'checkbox' ? false : '';
        return [f.param.name, new FormControl(initial, validators)];
    })));

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const values: Record<string, unknown> = {};
        for (const f of this.fields) {
            const raw = this.form.controls[f.param.name].value;
            if (raw === '' || raw == null) continue;
            values[f.param.name] = toWire(f.wireKind, raw);
        }
        this.dialogRef.close(values);
    }
}

function kindOf(dataType: string): ParamKind {
    switch ((dataType || '').toLowerCase()) {
        case 'boolean':
            return 'checkbox';
        case 'int':
        case 'integer':
        case 'number':
        case 'numeric':
        case 'float':
        case 'decimal':
            return 'number';
        case 'date':
            return 'date';
        case 'datetime':
        case 'timestamp':
            return 'datetime-local';
        default:
            return 'text';
    }
}

function toWire(kind: ParamKind, raw: unknown): unknown {
    if (kind === 'number') return Number(raw);
    // datetime-local holds local wall-clock time; keel expects a UTC instant.
    if (kind === 'datetime-local') {
        const d = new Date(String(raw));
        return isNaN(d.getTime()) ? raw : d.toISOString();
    }
    return raw;
}

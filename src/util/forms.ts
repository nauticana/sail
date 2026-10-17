import { AbstractControl } from "@angular/forms";

const INVALID = 'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, mat-select.ng-invalid';

/** True when `control` may submit; otherwise marks it touched and focuses the first invalid field in `scope`. */
export function submittable(control: AbstractControl, scope?: Element | null): boolean {
    if (!control.invalid) return true;
    control.markAllAsTouched();
    const field = scope?.matches(INVALID) ? scope : scope?.querySelector(INVALID);
    (field as HTMLElement | null | undefined)?.focus();
    return false;
}

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ValidationErrors } from "@angular/forms";
import { MatFormField } from "@angular/material/form-field";

/** Message for the enclosing field's first validation error: `<mat-error sailFieldError />`. */
@Component({
    selector: 'mat-error[sailFieldError]',
    // Eager: control errors are not signals, so the message is re-read on every check.
    changeDetection: ChangeDetectionStrategy.Eager,
    template: '{{ message }}',
})
export class FieldError {
    private readonly formField = inject(MatFormField);

    get message(): string {
        const errors: ValidationErrors | null | undefined = this.formField._control?.ngControl?.errors;
        if (!errors) return '';
        if (errors['required']) return 'This field is required.';
        if (errors['email']) return 'Enter a valid email address.';
        if (errors['minlength']) return `Use at least ${errors['minlength'].requiredLength} characters.`;
        if (errors['maxlength']) return `Use at most ${errors['maxlength'].requiredLength} characters.`;
        if (errors['min']) return `Enter ${errors['min'].min} or more.`;
        if (errors['max']) return `Enter ${errors['max'].max} or less.`;
        return 'Check this value.';
    }
}

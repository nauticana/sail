import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// keel PasswordPolicyView — the composition rules for pre-submit validation.
export interface PasswordRules {
  minLength: number;
  minUpper: number;
  minLower: number;
  minDigit: number;
}

type RulesSource = PasswordRules | (() => PasswordRules | undefined);

// Validator for keel's password policy. Empty is left to Validators.required;
// undefined rules (not loaded) skip the check. Char classes match keel's ASCII rules.
export function passwordPolicyValidator(source: RulesSource): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const rules = typeof source === 'function' ? source() : source;
    const value: string = control.value ?? '';
    if (!rules || !value) return null;
    let upper = 0, lower = 0, digit = 0;
    for (const ch of value) {
      if (ch >= 'A' && ch <= 'Z') upper++;
      else if (ch >= 'a' && ch <= 'z') lower++;
      else if (ch >= '0' && ch <= '9') digit++;
    }
    const unmet: string[] = [];
    if (value.length < rules.minLength) unmet.push(`${rules.minLength} characters`);
    if (upper < rules.minUpper) unmet.push('an uppercase letter');
    if (lower < rules.minLower) unmet.push('a lowercase letter');
    if (digit < rules.minDigit) unmet.push('a number');
    return unmet.length ? { passwordPolicy: { message: `Password needs ${unmet.join(', ')}.` } } : null;
  };
}

// Human-readable requirement string built from the loaded rules ('' when unknown).
export function passwordPolicyHint(rules?: PasswordRules): string {
  if (!rules) return '';
  const parts = [`at least ${rules.minLength} characters`];
  if (rules.minUpper > 0) parts.push('an uppercase letter');
  if (rules.minLower > 0) parts.push('a lowercase letter');
  if (rules.minDigit > 0) parts.push('a number');
  return `Use ${parts.join(', ')}.`;
}

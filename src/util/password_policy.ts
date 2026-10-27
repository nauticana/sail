import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// keel PasswordPolicyView — the composition rules for pre-submit validation.
export interface PasswordRules {
  minLength: number;
  minUpper: number;
  minLower: number;
  minDigit: number;
  minSpecial: number;
}

type RulesSource = PasswordRules | (() => PasswordRules | undefined);

// Validator for keel's password policy. Empty is left to Validators.required;
// undefined rules (not loaded) skip the check. Like keel, the length counts
// characters, an ASCII letter or digit counts toward its class, and any other
// character is special.
export function passwordPolicyValidator(source: RulesSource): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const rules = typeof source === 'function' ? source() : source;
    const value: string = control.value ?? '';
    if (!rules || !value) return null;
    const chars = [...value];
    let upper = 0, lower = 0, digit = 0, special = 0;
    for (const ch of chars) {
      if (ch >= 'A' && ch <= 'Z') upper++;
      else if (ch >= 'a' && ch <= 'z') lower++;
      else if (ch >= '0' && ch <= '9') digit++;
      else special++;
    }
    const unmet: string[] = [];
    if (chars.length < rules.minLength) unmet.push(`${rules.minLength} characters`);
    if (upper < rules.minUpper) unmet.push(count(rules.minUpper, 'an uppercase letter', 'uppercase letters'));
    if (lower < rules.minLower) unmet.push(count(rules.minLower, 'a lowercase letter', 'lowercase letters'));
    if (digit < rules.minDigit) unmet.push(count(rules.minDigit, 'a number', 'numbers'));
    if (special < rules.minSpecial) unmet.push(count(rules.minSpecial, 'a special character', 'special characters'));
    return unmet.length ? { passwordPolicy: { message: `Password needs ${unmet.join(', ')}.` } } : null;
  };
}

// Human-readable requirement string built from the loaded rules ('' when unknown).
export function passwordPolicyHint(rules?: PasswordRules): string {
  if (!rules) return '';
  const parts = [`at least ${rules.minLength} characters`];
  if (rules.minUpper > 0) parts.push(count(rules.minUpper, 'an uppercase letter', 'uppercase letters'));
  if (rules.minLower > 0) parts.push(count(rules.minLower, 'a lowercase letter', 'lowercase letters'));
  if (rules.minDigit > 0) parts.push(count(rules.minDigit, 'a number', 'numbers'));
  if (rules.minSpecial > 0) parts.push(count(rules.minSpecial, 'a special character', 'special characters'));
  return `Use ${parts.join(', ')}.`;
}

function count(n: number, one: string, many: string): string {
  return n > 1 ? `${n} ${many}` : one;
}

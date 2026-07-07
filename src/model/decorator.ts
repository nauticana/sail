import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// Plain decimal only — exponential notation ('1e21') must not slip past
// the precision/scale digit counts.
const DECIMAL = /^-?\d+(\.\d+)?$/;

@ValidatorConstraint({ name: 'isSailNumeric', async: false })
export class IsSailNumericConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }

    const [precision, scale] = args.constraints;
    const valueString = value.toString();
    if (!DECIMAL.test(valueString)) {
      return false;
    }
    const parts = valueString.split('.');
    const integerPart = parts[0].startsWith('-') ? parts[0].substring(1) : parts[0];
    const decimalPart = parts[1] || '';

    return integerPart.length + decimalPart.length <= precision && decimalPart.length <= scale;
  }

  defaultMessage(_args: ValidationArguments) {
    return `\$property must be a numeric value with a total precision of \$constraint1 digits and maximum of \$constraint2 decimal places.`;
  }
}

@ValidatorConstraint({ name: 'isSailString', async: false })
export class IsSailStringConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [maxLength] = args.constraints;

    if (typeof value !== 'string') {
      return false;
    }

    return value.length <= maxLength;
  }

  defaultMessage(_args: ValidationArguments) {
    return `\$property must be shorter than or equal to \$constraint1 characters.`;
  }
}

// Named IsSail* so they can't be confused with class-validator's own
// IsString/IsNumber on import.
export function IsSailNumeric(precision: number, scale: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [precision, scale],
      validator: IsSailNumericConstraint,
    });
  };
}

export function IsSailString(maxLength: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [maxLength],
      validator: IsSailStringConstraint,
    });
  };
}

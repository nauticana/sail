import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNumeric', async: false })
export class IsNumericConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'number') {
      return false;
    }

    const [precision, scale] = args.constraints;
    const valueString = value.toString();
    const parts = valueString.split('.');
    const integerPart = parts[0].startsWith('-') ? parts[0].substring(1) : parts[0];
    const decimalPart = parts[1] || '';

    // Check total digits vs precision and decimal digits vs scale
    if (integerPart.length + decimalPart.length > precision || decimalPart.length > scale) {
      return false;
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return `\$property must be a numeric value with a total precision of \$constraint1 digits and maximum of \$constraint2 decimal places.`;
  }
}

@ValidatorConstraint({ name: 'IsString', async: false })
export class IsStringConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
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

import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsNumeric(precision: number, scale: number, validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [precision, scale],
      validator: IsNumericConstraint,
    });
  };
}

export function IsString(maxLength: number, validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [maxLength],
      validator: IsStringConstraint,
    });
  };
}

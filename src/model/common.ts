import { IsString, IsNumeric } from './decorator';

/**
 * SIUD operation codes that travel on every row through keel's generic CRUD.
 * Sail tags records with these so the backend knows what to do with each row
 * inside a bulk POST. Mirror of keel's `data.SiudOpCode` constants.
 *
 *   S = Select-only (default for fetched rows — no change)
 *   I = Insert (locally created, not yet persisted)
 *   U = Update (existing row, scalar fields changed)
 *   D = Delete (existing row, mark for removal)
 *   R = Read-only (existing row, no change after dirty-check)
 *
 * Always reference via `OpCode.Insert` etc. — never the bare string. The
 * `OpCodeValue` union type lets TS catch typos at compile time.
 */
export const OpCode = {
  Select:   'S',
  Insert:   'I',
  Update:   'U',
  Delete:   'D',
  Readonly: 'R',
} as const;

export type OpCodeValue = typeof OpCode[keyof typeof OpCode];

/**
 * Lookup-style values on `TableColumn.LookupStyle` — controls how the lookup
 * renders in the form. Mirror of keel's basis `column.lookup_style` enum.
 *
 *   D = Dropdown (constant_value rows preloaded)
 *   S = Search   (TableLookup dialog with full search UI)
 */
export const LookupStyle = {
  Dropdown: 'D',
  Search:   'S',
} as const;

export type LookupStyleValue = typeof LookupStyle[keyof typeof LookupStyle];

export class SiudAction {
  op_code: OpCodeValue = OpCode.Select;
}

export class UserAccountPolicy extends SiudAction {
  @IsString(30)
  Id?:                           string;

  @IsNumeric(9, 0)
  PolicyValue?:                  number;

}


export class ApplicationMenuItem extends SiudAction {
  @IsString(30)
  MenuId?:                       string;

  @IsString(30)
  ItemId?:                       string;

  @IsString(80)
  Caption?:                      string;

  @IsNumeric(9, 0)
  DisplayOrder?:                 number;

  @IsString(255)
  RestUri?:                      string;

  @IsString(80)
  Icon?:                         string;

  IsActive?:                     boolean;

  FilterOnList?:                 boolean;

}


export class ApplicationMenu extends SiudAction {
  @IsString(30)
  Id?:                           string;

  @IsString(80)
  Caption?:                      string;

  @IsNumeric(9, 0)
  DisplayOrder?:                 number;

  @IsString(80)
  Icon?:                         string;

  IsActive?:                     boolean;

  ApplicationMenuItems?:         ApplicationMenuItem[];
}


export class AuthorizationRolePermission extends SiudAction {
  @IsString(30)
  RoleId?:                       string;

  @IsString(30)
  AuthorizationObjectId?:        string;

  @IsString(30)
  Action?:                       string;

  @IsString(80)
  LowLimit?:                     string;

  @IsString(80)
  HighLimit?:                    string;

  IsActive?:                     boolean;

}


export class ConstantValue extends SiudAction {
  @IsString(60)
  ConstantId?:                   string;

  @IsString(80)
  Value?:                        string;

  @IsString(80)
  Caption?:                      string;

}


export class UserAccount extends SiudAction {
  @IsNumeric(9, 0)
  Id?:                           number;

  @IsString(80)
  FirstName?:                    string;

  @IsString(80)
  LastName?:                     string;

  @IsString(80)
  UserName?:                     string;

  @IsString(255)
  UserEmail?:                    string;

  @IsString(1)
  Status?:                       string;

}

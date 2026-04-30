import { IsString, IsNumeric } from './decorator';

export class SiudAction {
  op_code = 'S';
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

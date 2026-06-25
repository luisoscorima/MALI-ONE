import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  primaryEmail!: string;

  @IsString()
  @MinLength(1)
  givenName!: string;

  @IsString()
  @MinLength(1)
  familyName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  orgUnitPath?: string;
}

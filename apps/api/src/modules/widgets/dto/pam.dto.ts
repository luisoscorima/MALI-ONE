import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePamSettingsDto {
  @IsArray()
  @IsString({ each: true })
  benefits!: string[];

  @IsArray()
  @IsString({ each: true })
  notes!: string[];
}

export class CreatePamPlanDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  color!: string;

  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  monthlyPrice!: string;

  @IsString()
  monthlyDuration!: string;

  @IsString()
  monthlyCheckout!: string;

  @IsArray()
  monthlyValues!: string[];

  @IsString()
  yearlyPrice!: string;

  @IsString()
  yearlyDuration!: string;

  @IsString()
  yearlyCheckout!: string;

  @IsArray()
  yearlyValues!: string[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdatePamPlanDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  monthlyPrice?: string;

  @IsOptional()
  @IsString()
  monthlyDuration?: string;

  @IsOptional()
  @IsString()
  monthlyCheckout?: string;

  @IsOptional()
  @IsArray()
  monthlyValues?: string[];

  @IsOptional()
  @IsString()
  yearlyPrice?: string;

  @IsOptional()
  @IsString()
  yearlyDuration?: string;

  @IsOptional()
  @IsString()
  yearlyCheckout?: string;

  @IsOptional()
  @IsArray()
  yearlyValues?: string[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreatePamRegistrationDto {
  @IsString()
  nombres!: string;

  @IsString()
  apellidos!: string;

  @IsString()
  dni!: string;

  @IsString()
  celular!: string;

  @IsEmail()
  correo!: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  distrito?: string;

  @IsOptional()
  @IsString()
  genero?: string;

  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  comoTeEnteraste?: string;

  @IsString()
  plan!: string;

  @IsString()
  frecuencia!: string;

  @IsOptional()
  @IsString()
  checkoutUrl?: string;

  @IsBoolean()
  aceptaPrivacidad!: boolean;
}

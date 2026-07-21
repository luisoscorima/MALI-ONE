import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const PAM_MP_STATUSES = [
  'pending',
  'in_process',
  'approved',
  'authorized',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
] as const;

const PAM_EMAIL_STATUSES = [
  'PENDIENTE',
  'ENVIADO',
  'ERROR_DATOS',
  'ERROR_TEMP',
] as const;

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

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsBoolean()
  aceptaPrivacidad!: boolean;
}

export class UpdatePamRegistrationDto {
  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  celular?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

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

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  frecuencia?: string;

  @IsOptional()
  @IsString()
  checkoutUrl?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  aceptaPrivacidad?: boolean;

  @IsOptional()
  @IsIn([...PAM_MP_STATUSES, ''])
  mpStatus?: string;

  @IsOptional()
  @IsIn(PAM_EMAIL_STATUSES)
  welcomeEmail?: string;

  @IsOptional()
  @IsIn(PAM_EMAIL_STATUSES)
  expiryNotice?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

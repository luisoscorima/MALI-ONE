import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsString,
  Length,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { parseVaultItemRef } from '@mali-one/shared';
import { TreasuryCurrency, TreasuryProvider } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class TreasuryPaymentQueryDto {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 250)
  q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page?: number;
  @IsOptional() @Matches(/^\d{9}$/)
  merchant?: string;
  @IsOptional() @IsString() @Length(1, 80)
  status?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  to?: string;
}

export class MercadoPagoPaymentQueryDto {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 250)
  q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page?: number;
  @IsOptional() @IsString() @Length(1, 80)
  status?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  to?: string;
}

export class PagoEfectivoPaymentQueryDto extends MercadoPagoPaymentQueryDto {}

export class TreasurySourceInputDto {
  @IsEnum(TreasuryProvider)
  provider!: TreasuryProvider;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  legalEntity?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value == null) return value;
    if (typeof value !== 'string') return value;
    return parseVaultItemRef(value);
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Pega el UUID del ítem o el enlace de Vaultwarden que incluye itemId.',
  })
  vaultItemId?: string | null;

  @IsBoolean()
  active!: boolean;
}

export class TreasuryTargetInputDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,63}$/, {
    message: 'La referencia debe tener entre 1 y 64 letras, números, puntos, guiones o guiones bajos, sin espacios.',
  })
  reference!: string;

  @IsEnum(TreasuryCurrency)
  currency!: TreasuryCurrency;

  @IsBoolean()
  active!: boolean;
}

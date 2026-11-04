import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsString, Length, Matches, IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
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

export class TreasurySourceInputDto {
  @IsEnum(TreasuryProvider)
  provider!: TreasuryProvider;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 160)
  legalEntity!: string;

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

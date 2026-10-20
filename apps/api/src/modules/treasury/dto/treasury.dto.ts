import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsString, Length, Matches } from 'class-validator';
import { TreasuryCurrency, TreasuryProvider } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

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

import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const MATERIAL_ICON_PATTERN = /^[a-z0-9_]+$/;

export class CreateEducacionSelectorSedeDto {
  @IsString()
  slug!: string;

  @IsString()
  nombre!: string;

  @IsString()
  brochureUrl!: string;

  @IsOptional()
  @IsString()
  @Matches(MATERIAL_ICON_PATTERN, {
    message: 'icon debe ser un nombre Material Icons válido',
  })
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateEducacionSelectorSedeDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  brochureUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(MATERIAL_ICON_PATTERN, {
    message: 'icon debe ser un nombre Material Icons válido',
  })
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

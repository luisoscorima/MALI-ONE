import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEducacionSelectorSedeDto {
  @IsString()
  slug!: string;

  @IsString()
  nombre!: string;

  @IsString()
  brochureUrl!: string;

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
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

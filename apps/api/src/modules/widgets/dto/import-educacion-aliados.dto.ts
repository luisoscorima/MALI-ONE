import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { EDUCACION_ALIADO_CATEGORIAS } from './create-educacion-aliado.dto';

export class ImportEducacionAliadoItemDto {
  @IsString()
  nombre!: string;

  /** Alias legacy de mapa_conf.js */
  @IsOptional()
  @IsString()
  imagen?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsIn([...EDUCACION_ALIADO_CATEGORIAS])
  categoria!: string;

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ImportEducacionAliadosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEducacionAliadoItemDto)
  items!: ImportEducacionAliadoItemDto[];

  /** Si true, desactiva aliados que no estén en la lista importada */
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

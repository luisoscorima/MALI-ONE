import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateEducacionPopupDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsString()
  imagenLinkUrl?: string | null;

  @IsOptional()
  @IsString()
  imagenTarget?: string;

  @IsOptional()
  @IsString()
  titulo?: string | null;

  @IsOptional()
  @IsString()
  botonTexto?: string;

  @IsOptional()
  @IsString()
  botonUrl?: string;

  @IsOptional()
  @IsString()
  botonTarget?: string;

  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  animationSpeedMs?: number;
}

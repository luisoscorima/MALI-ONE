import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWhatsappLinkDto {
  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  customSlug?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  catalogCursoId?: string | null;

  @IsOptional()
  @IsString()
  catalogProgramaId?: string | null;

  @IsOptional()
  @IsString()
  catalogSedeId?: string | null;
}

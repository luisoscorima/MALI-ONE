import { IsArray, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateLinkDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsOptional()
  @IsString()
  text?: string;

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

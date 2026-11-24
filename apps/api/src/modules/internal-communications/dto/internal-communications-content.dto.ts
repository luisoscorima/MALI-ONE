import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const NEWSLETTER_BRANDS = [
  'museo',
  'cursos_arte',
  'extension_profesional',
] as const;

export class CreateInternalCommunicationsContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject!: string;

  @IsString()
  @MinLength(1)
  htmlBody!: string;

  @IsOptional()
  @IsString()
  designJson?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...NEWSLETTER_BRANDS])
  brand?: (typeof NEWSLETTER_BRANDS)[number] | null;
}

export class UpdateInternalCommunicationsContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  htmlBody?: string;

  @IsOptional()
  @IsString()
  designJson?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...NEWSLETTER_BRANDS])
  brand?: (typeof NEWSLETTER_BRANDS)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contentRevision?: string;
}
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

export class CreateNewsletterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug: solo minúsculas, números y guiones',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
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

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}

export class UpdateNewsletterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
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
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}

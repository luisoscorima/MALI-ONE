import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEmailCampaignDto {
  @IsString()
  newsletterId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  audienceArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  audienceSegment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  audienceAttrKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  audienceAttrValue?: string;
}

export class ListCrmContactsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsString()
  attr_key?: string;

  @IsOptional()
  @IsString()
  attr_value?: string;

  @IsOptional()
  @IsString()
  has_email?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class PatchCrmContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  last_name?: string;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dni?: string | null;

  @IsOptional()
  @IsBoolean()
  opt_in?: boolean;

  @IsOptional()
  @IsBoolean()
  opt_in_email?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segment_slugs?: string[];

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;
}

export class CreateCrmAttributeDefinitionDto {
  @IsIn(['area', 'segment'])
  scope!: 'area' | 'segment';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segment_slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  field_type?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpdateCrmAttributeDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  field_type?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

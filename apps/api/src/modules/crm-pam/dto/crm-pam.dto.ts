import {
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

import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInternalCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  newsletterId!: string;

  /** Allows confirming a campaign with a draft newsletter created from Campañas internas. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  draftNewsletterId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Matches(/^[^\r\n]+$/)
  subject!: string;

  @IsEmail()
  @MaxLength(254)
  replyTo!: string;

  @IsEmail()
  @MaxLength(254)
  fromEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fromName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  orgUnitPaths!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  excludeOrgUnitPaths?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  activeDays?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateInternalNewsletterDraftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  title!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\r\n]+$/)
  subject?: string;
}

export class PreviewInternalAudienceDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  activeDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  orgUnitPaths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  excludeOrgUnitPaths?: string[];
}

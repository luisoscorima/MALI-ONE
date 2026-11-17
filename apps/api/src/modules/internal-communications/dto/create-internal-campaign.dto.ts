import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
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

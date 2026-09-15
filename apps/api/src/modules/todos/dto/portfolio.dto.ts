import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  OperationalServiceStatus,
  PortfolioArea,
  PortfolioImpact,
  PortfolioProjectType,
} from '@prisma/client';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class ListProjectsQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsEnum(PortfolioArea)
  area?: PortfolioArea;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeClosed?: boolean;
}

export class CreatePortfolioProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsEnum(PortfolioArea)
  area?: PortfolioArea;

  @IsOptional()
  @IsEnum(PortfolioProjectType)
  projectType?: PortfolioProjectType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  stakeholder?: string | null;

  @IsOptional()
  @IsEnum(PortfolioImpact)
  impact?: PortfolioImpact;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string | null;

  @IsOptional()
  @IsDateString()
  targetAt?: string | null;
}

export class UpdatePortfolioProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  detail?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsEnum(PortfolioArea)
  area?: PortfolioArea;

  @IsOptional()
  @IsEnum(PortfolioProjectType)
  projectType?: PortfolioProjectType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  stakeholder?: string | null;

  @IsOptional()
  @IsEnum(PortfolioImpact)
  impact?: PortfolioImpact;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string | null;

  @IsOptional()
  @IsDateString()
  targetAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ReorderProjectsDto {
  @IsString()
  statusId!: string;

  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

export class CreateOperationalServiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEnum(OperationalServiceStatus)
  status?: OperationalServiceStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateOperationalServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(OperationalServiceStatus)
  status?: OperationalServiceStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

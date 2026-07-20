import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
}

export class KardexQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  officeIds?: number[];

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  includeOpening?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  includeEnding?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  includeTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  forceOmission?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  refresh?: boolean;
}

export class KardexExportDto extends KardexQueryDto {
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';
}

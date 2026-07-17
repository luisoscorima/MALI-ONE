import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkQrExportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(['png', 'svg'])
  format?: 'png' | 'svg';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(2048)
  width?: number;
}

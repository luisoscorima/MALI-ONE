import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UpdateQrStyleDto } from './update-qr-style.dto';

export class SaveQrDefaultStyleDto extends UpdateQrStyleDto {}

export class UpdateQrStyleQueryDto {
  @IsOptional()
  saveAsDefault?: string;
}

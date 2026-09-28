import { IsBoolean } from 'class-validator';

export class SetLinkArchivedDto {
  @IsBoolean()
  archived!: boolean;
}

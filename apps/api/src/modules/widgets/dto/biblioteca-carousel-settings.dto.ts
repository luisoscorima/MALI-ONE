import { IsString, Matches } from 'class-validator';

export class UpdateBibliotecaCarouselSettingsDto {
  @IsString()
  headerTitle!: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'headerColor debe ser un color hexadecimal (#RRGGBB)',
  })
  headerColor!: string;
}

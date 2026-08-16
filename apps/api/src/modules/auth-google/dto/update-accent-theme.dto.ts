import { Matches } from 'class-validator';
import { ACCENT_THEME_IDS } from '@mali-one/shared';

const ACCENT_THEME_PATTERN = `^(${ACCENT_THEME_IDS.join('|')}|#[0-9A-Fa-f]{6})$`;

export class UpdateAccentThemeDto {
  @Matches(new RegExp(ACCENT_THEME_PATTERN), {
    message: 'accentTheme debe ser un preset o un color #RRGGBB',
  })
  accentTheme!: string;
}

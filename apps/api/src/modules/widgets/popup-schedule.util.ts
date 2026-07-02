/** Tiempos fijos del popup — no editables desde el configurador. */
export const POPUP_TIMING = {
  delayMs: 800,
  animationSpeedMs: 300,
} as const;

export type PopupScheduleFields = {
  scheduleEnabled: boolean;
  scheduleDateStart: string | null;
  scheduleDateEnd: string | null;
  scheduleTimeStart: string | null;
  scheduleTimeEnd: string | null;
  scheduleTimezone: string;
};

export type PopupContentFields = {
  activo: boolean;
  imagenUrl: string;
  imagenLinkUrl: string | null;
  imagenTarget: string;
  titulo: string | null;
  botonTexto: string;
  botonUrl: string;
  botonTarget: string;
  showOnce: boolean;
  delayMs: number;
  animationSpeedMs: number;
};

export type PopupSettingsRecord = PopupContentFields & PopupScheduleFields;

export type PopupPublicConfig =
  | { activo: false }
  | {
      activo: true;
      imagenUrl: string;
      imagenLinkUrl: string | null;
      imagenTarget: string;
      titulo: string | null;
      botonTexto: string;
      botonUrl: string;
      botonTarget: string;
      showOnce: boolean;
      delayMs: number;
      animationSpeedMs: number;
    };

function zonedDateTimeParts(timezone: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const hourRaw = get('hour');
  const hour = hourRaw === '24' ? '00' : hourRaw;

  return {
    dateYmd: `${get('year')}-${get('month')}-${get('day')}`,
    minutesOfDay: parseInt(hour, 10) * 60 + parseInt(get('minute'), 10),
  };
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isPopupWithinSchedule(
  schedule: PopupScheduleFields,
  now = new Date(),
): boolean {
  if (!schedule.scheduleEnabled) return true;

  const timezone = schedule.scheduleTimezone?.trim() || 'America/Lima';
  const { dateYmd, minutesOfDay } = zonedDateTimeParts(timezone, now);

  if (schedule.scheduleDateStart && dateYmd < schedule.scheduleDateStart) {
    return false;
  }
  if (schedule.scheduleDateEnd && dateYmd > schedule.scheduleDateEnd) {
    return false;
  }

  const startMin = parseTimeToMinutes(schedule.scheduleTimeStart);
  const endMin = parseTimeToMinutes(schedule.scheduleTimeEnd);

  if (startMin !== null && endMin !== null) {
    if (startMin <= endMin) {
      if (minutesOfDay < startMin || minutesOfDay > endMin) return false;
    } else if (minutesOfDay < startMin && minutesOfDay > endMin) {
      return false;
    }
  } else if (startMin !== null && minutesOfDay < startMin) {
    return false;
  } else if (endMin !== null && minutesOfDay > endMin) {
    return false;
  }

  return true;
}

export function buildPopupPublicConfig(
  popup: PopupSettingsRecord,
  now = new Date(),
): PopupPublicConfig {
  if (!popup.activo || !popup.imagenUrl.trim() || !popup.botonUrl.trim()) {
    return { activo: false };
  }

  if (!isPopupWithinSchedule(popup, now)) {
    return { activo: false };
  }

  return {
    activo: true,
    imagenUrl: popup.imagenUrl,
    imagenLinkUrl: popup.imagenLinkUrl,
    imagenTarget: popup.imagenTarget,
    titulo: popup.titulo,
    botonTexto: popup.botonTexto,
    botonUrl: popup.botonUrl,
    botonTarget: popup.botonTarget,
    showOnce: popup.showOnce,
    delayMs: POPUP_TIMING.delayMs,
    animationSpeedMs: POPUP_TIMING.animationSpeedMs,
  };
}

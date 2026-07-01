import { useCallback, useEffect, useState } from 'react';
import type {
  EducacionAdminStateDto,
  EducacionWidgetSettingsDto,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';

const SETTINGS_UPDATE_KEYS = [
  'whatsapp',
  'telefono',
  'email',
  'emailVirtual',
  'soporteVirtual',
  'imageRectangulo',
  'imageWhatsapp',
  'imageCirculo',
  'imageCorreo',
  'imageMarker',
  'mapsApiKey',
  'googleCalendarId',
] as const satisfies ReadonlyArray<keyof EducacionWidgetSettingsDto>;

type EducacionSettingsUpdate = Pick<
  EducacionWidgetSettingsDto,
  (typeof SETTINGS_UPDATE_KEYS)[number]
>;

function toSettingsUpdateBody(
  settings: EducacionWidgetSettingsDto,
): EducacionSettingsUpdate {
  return {
    whatsapp: settings.whatsapp,
    telefono: settings.telefono,
    email: settings.email,
    emailVirtual: settings.emailVirtual,
    soporteVirtual: settings.soporteVirtual,
    imageRectangulo: settings.imageRectangulo,
    imageWhatsapp: settings.imageWhatsapp,
    imageCirculo: settings.imageCirculo,
    imageCorreo: settings.imageCorreo,
    imageMarker: settings.imageMarker,
    mapsApiKey: settings.mapsApiKey,
    googleCalendarId: settings.googleCalendarId,
  };
}

export function useEducacionAdmin() {
  const toast = useToast();
  const [state, setState] = useState<EducacionAdminStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await api.getEducacionWidgetAdmin());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!state) return;
    setSaving(true);
    try {
      await api.updateEducacionWidgetSettings(toSettingsUpdateBody(state.settings));
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return { state, setState, loading, saving, saveSettings, reload: load };
}

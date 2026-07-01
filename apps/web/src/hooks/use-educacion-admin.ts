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

function toSettingsUpdateBody(
  settings: EducacionWidgetSettingsDto,
): Partial<EducacionWidgetSettingsDto> {
  const body: Partial<EducacionWidgetSettingsDto> = {};
  for (const key of SETTINGS_UPDATE_KEYS) {
    body[key] = settings[key];
  }
  return body;
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

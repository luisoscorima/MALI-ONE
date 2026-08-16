import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useAccentTheme } from '@/contexts/accent-theme-context';
import { isValidAccentTheme } from '@/lib/accent-themes';

/**
 * Sincroniza el color de interfaz con la preferencia del usuario en servidor.
 * localStorage cubre la carga inmediata; el servidor es la fuente por cuenta.
 */
export function AccentThemeUserSync() {
  const { user, patchUser } = useAuth();
  const { accentId, setAccentId } = useAccentTheme();
  const syncedUserIdRef = useRef<string | null>(null);
  const skipPersistRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!user) {
      syncedUserIdRef.current = null;
      readyRef.current = false;
      return;
    }

    if (syncedUserIdRef.current === user.id) return;
    syncedUserIdRef.current = user.id;

    if (user.accentTheme && isValidAccentTheme(user.accentTheme)) {
      skipPersistRef.current = true;
      setAccentId(user.accentTheme);
    }

    readyRef.current = true;
  }, [user, setAccentId]);

  useEffect(() => {
    if (!user || !readyRef.current) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (user.accentTheme === accentId) return;

    void api
      .updateAccentTheme(accentId)
      .then((updated) => patchUser({ accentTheme: updated.accentTheme }))
      .catch(() => {
        /* ignore: sin sesión o error de red */
      });
  }, [accentId, user, patchUser]);

  return null;
}

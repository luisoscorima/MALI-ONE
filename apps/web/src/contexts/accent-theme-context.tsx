import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACCENT_STORAGE_KEY,
  applyAccentTheme,
  defaultAccentThemeId,
  isAccentHex,
  persistCustomAccentHex,
  readStoredAccentTheme,
  type AccentThemeValue,
} from '@/lib/accent-themes';

type AccentThemeContextValue = {
  accentId: AccentThemeValue;
  setAccentId: (id: AccentThemeValue) => void;
};

const AccentThemeContext = createContext<AccentThemeContextValue | null>(null);

function persistLocal(id: AccentThemeValue) {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  if (isAccentHex(id)) {
    persistCustomAccentHex(id);
  }
}

export function AccentThemeProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentIdState] =
    useState<AccentThemeValue>(defaultAccentThemeId);

  useEffect(() => {
    const stored = readStoredAccentTheme();
    setAccentIdState(stored);
    applyAccentTheme(stored);
  }, []);

  const setAccentId = useCallback((id: AccentThemeValue) => {
    const next = isAccentHex(id) ? id.toLowerCase() : id;
    setAccentIdState(next);
    applyAccentTheme(next);
    persistLocal(next);
  }, []);

  const value = useMemo(
    () => ({ accentId, setAccentId }),
    [accentId, setAccentId],
  );

  return (
    <AccentThemeContext.Provider value={value}>
      {children}
    </AccentThemeContext.Provider>
  );
}

export function useAccentTheme() {
  const ctx = useContext(AccentThemeContext);
  if (!ctx) {
    throw new Error('useAccentTheme debe usarse dentro de AccentThemeProvider');
  }
  return ctx;
}

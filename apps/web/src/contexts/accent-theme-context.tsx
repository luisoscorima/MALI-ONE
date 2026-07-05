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
  readStoredAccentTheme,
  type AccentThemeId,
} from '@/lib/accent-themes';

type AccentThemeContextValue = {
  accentId: AccentThemeId;
  setAccentId: (id: AccentThemeId) => void;
};

const AccentThemeContext = createContext<AccentThemeContextValue | null>(null);

export function AccentThemeProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentIdState] = useState<AccentThemeId>(defaultAccentThemeId);

  useEffect(() => {
    const stored = readStoredAccentTheme();
    setAccentIdState(stored);
    applyAccentTheme(stored);
  }, []);

  const setAccentId = useCallback((id: AccentThemeId) => {
    setAccentIdState(id);
    applyAccentTheme(id);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
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

import { ThemeProvider } from 'next-themes';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export const COLOR_SCHEME_STORAGE_KEY = 'mali-one-color-scheme';

function shouldForceDark(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/presentacion') ||
    pathname.startsWith('/screen-cast')
  );
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const forceDark = shouldForceDark(pathname);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={COLOR_SCHEME_STORAGE_KEY}
      forcedTheme={forceDark ? 'dark' : undefined}
    >
      {children}
    </ThemeProvider>
  );
}

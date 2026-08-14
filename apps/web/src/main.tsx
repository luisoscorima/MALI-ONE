import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyAccentTheme, applyLoginAmbientColors, readStoredAccentTheme } from '@/lib/accent-themes';
import { applySessionFavicon } from '@/lib/session-favicon';
import { App } from './App';
import './index.css';

applyLoginAmbientColors();
applyAccentTheme(readStoredAccentTheme());
void applySessionFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

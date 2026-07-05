import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyAccentTheme, applyLoginAmbientColors, readStoredAccentTheme } from '@/lib/accent-themes';
import { App } from './App';
import './index.css';

applyLoginAmbientColors();
applyAccentTheme(readStoredAccentTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

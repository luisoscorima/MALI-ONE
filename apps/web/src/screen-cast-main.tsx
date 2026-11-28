import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScreenCastPlayerPage } from '@/pages/screen-cast-player-page';
import './index.css';

const container = document.getElementById('root')!;
const startup = container.firstElementChild as HTMLElement;

createRoot(container, {
  onUncaughtError(error) {
    console.error('Screen Cast no pudo iniciar', error);
    startup.querySelector('[role="status"]')!.textContent =
      'No se pudo iniciar la pantalla';
    container.replaceChildren(startup);
  },
}).render(
  <StrictMode>
    <ScreenCastPlayerPage />
  </StrictMode>,
);

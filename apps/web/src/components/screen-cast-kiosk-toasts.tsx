import type { CSSProperties } from 'react';

export type KioskToastTone = 'ok' | 'info' | 'warn' | 'err';

export type KioskToast = {
  id: number;
  text: string;
  tone: KioskToastTone;
};

const TONE_CLASS: Record<KioskToastTone, string> = {
  ok: 'border-emerald-400/60 bg-emerald-950/90 text-emerald-50',
  info: 'border-white/25 bg-black/90 text-white',
  warn: 'border-amber-300/60 bg-amber-950/90 text-amber-50',
  err: 'border-red-300/60 bg-red-950/90 text-red-50',
};

/**
 * TVs overscan the outer ~4% and are watched from several metres away, so
 * kiosk messages sit well inside the frame and scale with the panel.
 */
const STACK_STYLE: CSSProperties = {
  position: 'absolute',
  left: '4%',
  bottom: '5%',
  maxWidth: '60%',
  zIndex: 30,
  fontSize: 'clamp(16px, 1.5vmax, 32px)',
};

export function KioskToastStack({ toasts }: { toasts: KioskToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none flex flex-col gap-2"
      style={STACK_STYLE}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-2 leading-snug tracking-wide shadow-2xl ${TONE_CLASS[toast.tone]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

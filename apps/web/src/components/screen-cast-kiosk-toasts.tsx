export type KioskToastTone = 'ok' | 'info' | 'warn' | 'err';

export type KioskToast = {
  id: number;
  text: string;
  tone: KioskToastTone;
};

const TONE_CLASS: Record<KioskToastTone, string> = {
  ok: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-100',
  info: 'border-white/15 bg-black/75 text-white',
  warn: 'border-amber-400/40 bg-amber-950/80 text-amber-100',
  err: 'border-red-400/40 bg-red-950/80 text-red-100',
};

export function KioskToastStack({ toasts }: { toasts: KioskToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex max-w-[min(92vw,20rem)] flex-col gap-1.5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border px-2.5 py-1.5 text-[11px] leading-snug tracking-wide shadow-lg ${TONE_CLASS[toast.tone]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

import type { CSSProperties } from 'react';

const HUD_STYLE: CSSProperties = {
  position: 'absolute',
  left: '4%',
  top: '5%',
  maxWidth: '70%',
  zIndex: 40,
  fontSize: 'clamp(14px, 1.2vmax, 26px)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

/** Always-on state readout for diagnosing a kiosk screen (?debug=1). */
export function KioskDebugHud({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div
      className="pointer-events-none rounded-lg border border-white/25 bg-black/85 px-4 py-2 leading-relaxed text-white shadow-2xl"
      style={HUD_STYLE}
    >
      {lines.map((line, i) => (
        // Fixed-length readout: position identifies the row, not the text.
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

import { useState } from 'react';
import type { EducacionPopupSettingsDto } from '@mali-one/shared';
import { Button, Card, Input } from '@/components/ui';

type PopupLike = EducacionPopupSettingsDto;

export function PopupVisualPreview({ popup }: { popup: PopupLike }) {
  const [open, setOpen] = useState(true);

  if (!popup.activo) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          El popup está <strong>desactivado</strong>. Actívalo en Configuración para
          que aparezca en el sitio.
        </p>
      </Card>
    );
  }

  if (!popup.imagenUrl.trim()) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          Añade una URL de imagen en Configuración para ver la vista previa.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="text-sm text-muted">Así se verá el overlay en el sitio</p>
        <Button
          variant="outline"
          className="text-xs px-2 py-1"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Ocultar popup' : 'Mostrar popup'}
        </Button>
      </div>

      <div
        className="relative flex min-h-[420px] items-center justify-center bg-[#333333]/80 p-6"
        role="presentation"
      >
        {!open && (
          <p className="text-sm text-white/80">
            Popup cerrado — pulsa «Mostrar popup» para simularlo
          </p>
        )}

        {open && (
          <div className="relative w-full max-w-[500px]">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 text-3xl leading-none text-white"
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <div className="overflow-hidden shadow-2xl">
              {popup.imagenLinkUrl ? (
                <a
                  href={popup.imagenLinkUrl}
                  target={popup.imagenTarget}
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={popup.imagenUrl}
                    alt={popup.titulo ?? 'Popup'}
                    className="block w-full object-cover"
                  />
                </a>
              ) : (
                <img
                  src={popup.imagenUrl}
                  alt={popup.titulo ?? 'Popup'}
                  className="block w-full object-cover"
                />
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <a
                href={popup.botonUrl || '#'}
                target={popup.botonTarget}
                rel="noopener noreferrer"
                className="inline-block min-w-[165px] bg-[#702082] px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white no-underline hover:bg-[#ae3dc7]"
              >
                {popup.botonTexto || 'Ver más'}
              </a>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-1 border-t border-border px-4 py-3 text-xs text-muted">
        <li>Espera antes de abrir: {(popup.delayMs / 1000).toFixed(1).replace(/\.0$/, '')} s</li>
        <li>Duración al cerrar: {(popup.animationSpeedMs / 1000).toFixed(1).replace(/\.0$/, '')} s</li>
        {popup.showOnce && (
          <li>Se muestra una sola vez por visitante (localStorage)</li>
        )}
        {popup.scheduleEnabled && (
          <li>
            Horario: {popup.scheduleDateStart || '—'} → {popup.scheduleDateEnd || '—'},{' '}
            {popup.scheduleTimeStart || '00:00'}–{popup.scheduleTimeEnd || '23:59'} (
            {popup.scheduleTimezone})
          </li>
        )}
      </ul>
    </Card>
  );
}

export function PopupSettingsFields({
  popup,
  onChange,
  siteLabel,
}: {
  popup: PopupLike;
  onChange: (patch: Partial<PopupLike>) => void;
  siteLabel: string;
}) {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Popup promocional</h2>
        <p className="text-sm text-muted">
          Overlay global en {siteLabel}. Los cambios se publican al guardar.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={popup.activo}
          onChange={(e) => onChange({ activo: e.target.checked })}
        />
        Popup activo (manual)
      </label>

      <Input
        placeholder="URL de la imagen"
        value={popup.imagenUrl}
        onChange={(e) => onChange({ imagenUrl: e.target.value })}
      />

      {popup.imagenUrl && (
        <img
          src={popup.imagenUrl}
          alt={popup.titulo ?? 'Vista previa popup'}
          className="max-h-48 rounded border border-border object-contain"
        />
      )}

      <Input
        placeholder="URL al hacer clic en la imagen (opcional)"
        value={popup.imagenLinkUrl ?? ''}
        onChange={(e) =>
          onChange({ imagenLinkUrl: e.target.value || null })
        }
      />

      <Input
        placeholder="Título / alt de la imagen"
        value={popup.titulo ?? ''}
        onChange={(e) => onChange({ titulo: e.target.value || null })}
      />

      <Input
        placeholder="Texto del botón"
        value={popup.botonTexto}
        onChange={(e) => onChange({ botonTexto: e.target.value })}
      />
      <Input
        placeholder="URL del botón"
        value={popup.botonUrl}
        onChange={(e) => onChange({ botonUrl: e.target.value })}
      />

      <div className="space-y-1">
        <label className="text-sm" htmlFor="popup-delay-seconds">
          Espera antes de mostrar el popup
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="popup-delay-seconds"
            type="number"
            min={0}
            step={0.5}
            className="max-w-[8rem]"
            value={popup.delayMs / 1000}
            onChange={(e) =>
              onChange({ delayMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) || 0 })
            }
          />
          <span className="text-sm text-muted">segundos</span>
        </div>
        <p className="text-xs text-muted">
          Tiempo tras cargar la página antes de que aparezca el overlay.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="popup-close-seconds">
          Duración al cerrar
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="popup-close-seconds"
            type="number"
            min={0}
            step={0.1}
            className="max-w-[8rem]"
            value={popup.animationSpeedMs / 1000}
            onChange={(e) =>
              onChange({
                animationSpeedMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) || 0,
              })
            }
          />
          <span className="text-sm text-muted">segundos</span>
        </div>
        <p className="text-xs text-muted">
          Velocidad de la animación cuando el visitante cierra el popup.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={popup.showOnce}
          onChange={(e) => onChange({ showOnce: e.target.checked })}
        />
        Mostrar solo una vez por visitante (localStorage)
      </label>

      <div className="space-y-3 rounded border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={popup.scheduleEnabled}
            onChange={(e) =>
              onChange({ scheduleEnabled: e.target.checked })
            }
          />
          Activar por horario (fechas y horas)
        </label>
        <p className="text-xs text-muted">
          Si está activo, el popup solo se muestra dentro del rango aunque el toggle
          manual esté encendido. Fuera de ventana la API responde{' '}
          <code>activo: false</code>.
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          <Input
            type="date"
            value={popup.scheduleDateStart ?? ''}
            onChange={(e) =>
              onChange({
                scheduleDateStart: e.target.value || null,
              })
            }
          />
          <Input
            type="date"
            value={popup.scheduleDateEnd ?? ''}
            onChange={(e) =>
              onChange({ scheduleDateEnd: e.target.value || null })
            }
          />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Input
            type="time"
            value={popup.scheduleTimeStart ?? ''}
            onChange={(e) =>
              onChange({
                scheduleTimeStart: e.target.value || null,
              })
            }
          />
          <Input
            type="time"
            value={popup.scheduleTimeEnd ?? ''}
            onChange={(e) =>
              onChange({ scheduleTimeEnd: e.target.value || null })
            }
          />
          <Input
            placeholder="Zona horaria"
            value={popup.scheduleTimezone}
            onChange={(e) =>
              onChange({ scheduleTimezone: e.target.value })
            }
          />
        </div>
      </div>
    </Card>
  );
}

export function popupPayloadFromSettings(popup: PopupLike) {
  return {
    activo: popup.activo,
    imagenUrl: popup.imagenUrl.trim(),
    imagenLinkUrl: popup.imagenLinkUrl?.trim() || null,
    imagenTarget: popup.imagenTarget,
    titulo: popup.titulo?.trim() || null,
    botonTexto: popup.botonTexto.trim(),
    botonUrl: popup.botonUrl.trim(),
    botonTarget: popup.botonTarget,
    showOnce: popup.showOnce,
    delayMs: popup.delayMs,
    animationSpeedMs: popup.animationSpeedMs,
    scheduleEnabled: popup.scheduleEnabled,
    scheduleDateStart: popup.scheduleDateStart || null,
    scheduleDateEnd: popup.scheduleDateEnd || null,
    scheduleTimeStart: popup.scheduleTimeStart || null,
    scheduleTimeEnd: popup.scheduleTimeEnd || null,
    scheduleTimezone: popup.scheduleTimezone || 'America/Lima',
  };
}

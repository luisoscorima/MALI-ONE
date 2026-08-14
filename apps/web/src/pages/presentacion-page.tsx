import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { MALI_MARK_URL } from '@/components/mali-logo';
import { Card } from '@/components/ui/card';
import { moduleCardAccentStyles } from '@/lib/module-card-accents';
import { cn } from '@/lib/utils';
import {
  PRESENTACION_ASSETS,
  presentacionClosing,
  presentacionGroups,
  presentacionHero,
  presentacionValueProps,
} from '@/lib/presentacion-content';

function IsoSlot({
  filename,
  alt,
  className,
}: {
  filename?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = filename ? `${PRESENTACION_ASSETS}/${filename}` : undefined;
  const showImage = Boolean(src) && !failed;

  if (showImage) {
    return (
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-2xl bg-card/40 ring-1 ring-border/60',
          className,
        )}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain p-2"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/30 px-4 py-8 text-center text-muted-foreground',
        className,
      )}
      aria-label={
        filename
          ? `Placeholder: añadir isométrico ${filename}`
          : 'Placeholder de gráfico isométrico'
      }
    >
      <ImageIcon className="size-8 opacity-50" strokeWidth={1.5} />
      <p className="text-xs leading-relaxed">
        {filename ? (
          <>
            Añadir isométrico:{' '}
            <span className="font-mono text-foreground/80">{filename}</span>
          </>
        ) : (
          'Espacio para gráfico isométrico'
        )}
      </p>
    </div>
  );
}

export function PresentacionPage() {
  return (
    <div className="login-shell relative min-h-svh overflow-x-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-ambient login-ambient-emerald" />
        <div className="login-ambient login-ambient-violet" />
        <div className="login-ambient login-ambient-blue" />
        <div className="login-grid-overlay" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-12 md:gap-24 md:px-10 md:py-16">
        {/* Hero */}
        <header className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <img
                src={MALI_MARK_URL}
                alt=""
                className="login-logo-glow h-14 w-14 object-contain md:h-16 md:w-16"
              />
              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Presentación
                </p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  {presentacionHero.title}
                </h1>
              </div>
            </div>
            <p className="text-lg text-muted-foreground md:text-xl">
              {presentacionHero.subtitle}
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {presentacionHero.lead}
            </p>
          </div>
          <IsoSlot
            filename={presentacionHero.image}
            alt="Ilustración isométrica de MALI ONE"
            className="min-h-56 md:min-h-72"
          />
        </header>

        {/* Qué es */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Qué aporta
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              Valor para la operación del museo
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {presentacionValueProps.map((item) => (
              <Card
                key={item.title}
                className="bg-gradient-to-t from-blue-500/10 to-card p-5 shadow-xs ring-1 ring-border/50"
              >
                <h3 className="mb-1.5 font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Módulos */}
        <section className="flex flex-col gap-14">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Módulos
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              Qué hace el sistema hoy
            </p>
          </div>

          {presentacionGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-6">
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
                <div>
                  <h3 className="text-lg font-semibold">{group.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.modules.length}{' '}
                    {group.modules.length === 1 ? 'módulo' : 'módulos'}
                  </p>
                </div>
                <IsoSlot
                  filename={group.image}
                  alt={`Ilustración de ${group.label}`}
                  className="min-h-36"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.modules.map((mod) => {
                  const styles = moduleCardAccentStyles[mod.accent];
                  return (
                    <Card
                      key={mod.id}
                      className={cn(
                        'overflow-hidden bg-gradient-to-t to-card shadow-xs ring-1 ring-border/50',
                        styles.gradient,
                      )}
                    >
                      <div className="flex flex-col gap-4 p-5">
                        <IsoSlot
                          filename={mod.image}
                          alt={`Ilustración de ${mod.title}`}
                          className="min-h-32"
                        />
                        <div>
                          <h4 className="mb-1.5 font-semibold leading-tight">
                            {mod.title}
                          </h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {mod.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Cierre */}
        <footer className="flex flex-col items-start gap-6 rounded-2xl bg-card/50 p-8 ring-1 ring-border/60 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-tight">
              {presentacionClosing.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {presentacionClosing.description}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ir al acceso
          </Link>
        </footer>
      </div>
    </div>
  );
}

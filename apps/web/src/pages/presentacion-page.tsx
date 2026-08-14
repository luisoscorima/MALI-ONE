import { Link } from 'react-router-dom';
import { MALI_MARK_URL } from '@/components/mali-logo';
import { Card } from '@/components/ui/card';
import { moduleCardAccentStyles } from '@/lib/module-card-accents';
import { cn } from '@/lib/utils';
import {
  PRESENTACION_ASSETS,
  presentacionClosing,
  presentacionDiagrams,
  presentacionGroups,
  presentacionHero,
  presentacionRoadmap,
  presentacionValueProps,
} from '@/lib/presentacion-content';

function DiagramFigure({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-2xl bg-white/95 p-3 shadow-xs ring-1 ring-border/60 sm:p-4">
        <img src={src} alt={alt} className="h-auto w-full object-contain" />
      </div>
      {caption ? (
        <figcaption className="text-sm leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
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
        <header className="flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex items-center gap-3">
              <img
                src={MALI_MARK_URL}
                alt=""
                className="login-logo-glow h-14 w-14 object-contain md:h-16 md:w-16"
              />
              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Presentación a gerencia
                </p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  {presentacionHero.title}
                </h1>
              </div>
            </div>
            <p className="text-lg text-muted-foreground md:text-xl">
              {presentacionHero.subtitle}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {presentacionHero.lead}
            </p>
          </div>
          {presentacionHero.image ? (
            <DiagramFigure
              src={`${PRESENTACION_ASSETS}/${presentacionHero.image}`}
              alt="Infraestructura antes versus ahora con MALI ONE"
              caption="De servidores fragmentados a una plataforma unificada en la nube."
              className="max-w-4xl"
            />
          ) : null}
        </header>

        {/* Qué aporta */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              El problema y la respuesta
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              Por qué centralizar con MALI ONE
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

        {/* Diagramas */}
        <section className="flex flex-col gap-10">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contexto
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              Cómo está hoy el ecosistema digital
            </p>
          </div>
          <div className="grid gap-10 lg:grid-cols-1">
            {presentacionDiagrams.map((diagram) => (
              <div key={diagram.id} className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">{diagram.title}</h3>
                <DiagramFigure
                  src={`${PRESENTACION_ASSETS}/${diagram.image}`}
                  alt={diagram.title}
                  caption={diagram.caption}
                />
              </div>
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
              Qué resuelve cada pieza
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Cada módulo nace de un dolor concreto: costo de terceros, falta de
              control o procesos lentos. Aquí, el “por qué” de negocio.
            </p>
          </div>

          {presentacionGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-5">
              <div>
                <h3 className="text-lg font-semibold">{group.label}</h3>
                {group.summary ? (
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {group.summary}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {group.modules.map((mod) => {
                  const styles = moduleCardAccentStyles[mod.accent];
                  return (
                    <Card
                      key={mod.id}
                      className={cn(
                        'bg-gradient-to-t to-card p-5 shadow-xs ring-1 ring-border/50',
                        styles.gradient,
                      )}
                    >
                      <div
                        className={cn(
                          'mb-3 inline-flex h-2 w-10 rounded-full',
                          styles.icon.split(' ')[0],
                        )}
                        aria-hidden
                      />
                      <h4 className="mb-1.5 font-semibold leading-tight">
                        {mod.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {mod.description}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Roadmap */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Próximos pasos
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {presentacionRoadmap.title}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {presentacionRoadmap.items.map((item) => (
              <Card
                key={item.title}
                className="bg-gradient-to-t from-violet-500/10 to-card p-5 shadow-xs ring-1 ring-border/50"
              >
                <h3 className="mb-1.5 font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
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

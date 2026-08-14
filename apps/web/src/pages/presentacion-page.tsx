import { Link } from 'react-router-dom';
import { MALI_MARK_URL } from '@/components/mali-logo';
import { Card } from '@/components/ui/card';
import { moduleCardAccentStyles } from '@/lib/module-card-accents';
import { cn } from '@/lib/utils';
import {
  PRESENTACION_ASSETS,
  PRESENTACION_LOGOS,
  presentacionClosing,
  presentacionDiagrams,
  presentacionGroups,
  presentacionHero,
  presentacionReplacedTools,
  presentacionRoadmap,
  presentacionValueProps,
  type PresentacionLogo,
} from '@/lib/presentacion-content';

/** Texto secundario legible sobre el fondo login-shell (más claro que muted-foreground). */
const bodyText = 'text-base leading-relaxed text-zinc-200 md:text-lg';
const supportText = 'text-base leading-relaxed text-zinc-300';
const eyebrow =
  'text-sm font-semibold uppercase tracking-wider text-zinc-300';

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
    <figure className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-hidden rounded-2xl bg-white p-3 shadow-md ring-1 ring-white/20 sm:p-5">
        <img src={src} alt={alt} className="h-auto w-full object-contain" />
      </div>
      {caption ? (
        <figcaption className={supportText}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}

function ToolLogo({
  logo,
  size = 'md',
}: {
  logo: PresentacionLogo;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box =
    size === 'lg'
      ? 'h-20 w-32 sm:h-24 sm:w-36'
      : size === 'sm'
        ? 'h-10 w-16'
        : 'h-12 w-20';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/15',
        logo.darkBg ? 'bg-black' : 'bg-white',
        box,
      )}
      title={logo.name}
    >
      <img
        src={`${PRESENTACION_LOGOS}/${logo.file}`}
        alt={logo.name}
        className="max-h-[82%] max-w-[88%] object-contain"
        loading="lazy"
      />
    </div>
  );
}

function ReplacesRow({ logos }: { logos: PresentacionLogo[] }) {
  if (logos.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
        Reemplaza / articula
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        {logos.map((logo) => (
          <ToolLogo key={logo.id} logo={logo} size="sm" />
        ))}
      </div>
    </div>
  );
}

export function PresentacionPage() {
  return (
    <div className="login-shell relative min-h-svh overflow-x-hidden text-zinc-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-ambient login-ambient-emerald opacity-70" />
        <div className="login-ambient login-ambient-violet opacity-70" />
        <div className="login-ambient login-ambient-blue opacity-70" />
        <div className="login-grid-overlay opacity-40" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-12 md:gap-28 md:px-10 md:py-20">
        {/* Hero */}
        <header className="flex flex-col gap-12">
          <div className="flex max-w-3xl flex-col gap-7">
            <div className="flex items-center gap-5 md:gap-6">
              <img
                src={MALI_MARK_URL}
                alt="MALI ONE"
                className="login-logo-glow h-28 w-28 object-contain md:h-36 md:w-36"
              />
              <div className="leading-tight">
                <p className={eyebrow}>Presentación a gerencia</p>
                <h1 className="mt-1 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                  {presentacionHero.title}
                </h1>
              </div>
            </div>
            <p className="text-xl font-medium text-zinc-100 md:text-2xl">
              {presentacionHero.subtitle}
            </p>
            <p className={cn(bodyText, 'max-w-2xl')}>{presentacionHero.lead}</p>
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

        {/* Logos de herramientas que se suplanta */}
        <section className="flex flex-col gap-8">
          <div>
            <h2 className={eyebrow}>Antes</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Herramientas que MALI ONE suplanta o centraliza
            </p>
            <p className={cn(supportText, 'mt-3 max-w-2xl')}>
              Suscripciones y plataformas sueltas que el museo usaba por separado.
              El objetivo: un solo panel, menos costo y más control.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {presentacionReplacedTools.map((logo) => (
              <div
                key={logo.id}
                className="flex flex-col items-center gap-3 rounded-2xl bg-[#1a1f26]/90 p-4 ring-1 ring-white/15"
              >
                <ToolLogo logo={logo} size="lg" />
                <span className="text-center text-sm font-medium text-zinc-100">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Qué aporta */}
        <section className="flex flex-col gap-8">
          <div>
            <h2 className={eyebrow}>El problema y la respuesta</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Por qué centralizar con MALI ONE
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {presentacionValueProps.map((item) => (
              <Card
                key={item.title}
                className="border-0 bg-[#1a1f26]/95 p-6 shadow-md ring-1 ring-white/15"
              >
                <h3 className="mb-2 text-lg font-semibold text-white md:text-xl">
                  {item.title}
                </h3>
                <p className={bodyText}>{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Diagramas */}
        <section className="flex flex-col gap-12">
          <div>
            <h2 className={eyebrow}>Contexto</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Cómo está hoy el ecosistema digital
            </p>
          </div>
          <div className="grid gap-12">
            {presentacionDiagrams.map((diagram) => (
              <div key={diagram.id} className="flex flex-col gap-4">
                <h3 className="text-xl font-semibold text-white md:text-2xl">
                  {diagram.title}
                </h3>
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
        <section className="flex flex-col gap-16">
          <div>
            <h2 className={eyebrow}>Módulos</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Qué resuelve cada pieza
            </p>
            <p className={cn(supportText, 'mt-3 max-w-2xl')}>
              Cada módulo nace de un dolor concreto: costo de terceros, falta de
              control o procesos lentos. Aquí, el “por qué” de negocio.
            </p>
          </div>

          {presentacionGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-6">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  {group.label}
                </h3>
                {group.summary ? (
                  <p className={cn(supportText, 'mt-2 max-w-3xl')}>
                    {group.summary}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {group.modules.map((mod) => {
                  const styles = moduleCardAccentStyles[mod.accent];
                  return (
                    <Card
                      key={mod.id}
                      className={cn(
                        'border-0 bg-[#1a1f26]/95 p-6 shadow-md ring-1 ring-white/15',
                        'bg-gradient-to-t to-[#1a1f26]',
                        styles.gradient,
                      )}
                    >
                      <div
                        className={cn(
                          'mb-4 inline-flex h-2.5 w-12 rounded-full',
                          styles.icon.split(' ')[0],
                        )}
                        aria-hidden
                      />
                      <h4 className="mb-2 text-lg font-semibold leading-tight text-white md:text-xl">
                        {mod.title}
                      </h4>
                      <p className={bodyText}>{mod.description}</p>
                      {mod.replaces ? (
                        <ReplacesRow logos={mod.replaces} />
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Roadmap */}
        <section className="flex flex-col gap-8">
          <div>
            <h2 className={eyebrow}>Próximos pasos</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              {presentacionRoadmap.title}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {presentacionRoadmap.items.map((item) => (
              <Card
                key={item.title}
                className="border-0 bg-[#1a1f26]/95 p-6 shadow-md ring-1 ring-white/15"
              >
                <h3 className="mb-2 text-lg font-semibold text-white md:text-xl">
                  {item.title}
                </h3>
                <p className={bodyText}>{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <footer className="flex flex-col items-start gap-8 rounded-2xl bg-[#1a1f26]/95 p-8 ring-1 ring-white/15 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {presentacionClosing.title}
            </h2>
            <p className={cn(bodyText, 'mt-3')}>
              {presentacionClosing.description}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-3 text-base font-semibold text-zinc-900 transition-opacity hover:opacity-90"
          >
            Ir al acceso
          </Link>
        </footer>
      </div>
    </div>
  );
}

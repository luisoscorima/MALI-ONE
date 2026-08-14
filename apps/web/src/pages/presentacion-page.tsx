import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { MALI_MARK_URL } from '@/components/mali-logo';
import { moduleCardAccentStyles } from '@/lib/module-card-accents';
import { cn } from '@/lib/utils';
import {
  PRESENTACION_ASSETS,
  PRESENTACION_LOGOS,
  type PresentacionLogo,
} from '@/lib/presentacion-content';
import {
  presentacionSlides,
  type PresentacionSlide,
} from '@/lib/presentacion-slides';

function ToolLogo({
  logo,
  size = 'md',
}: {
  logo: PresentacionLogo;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box =
    size === 'lg'
      ? 'h-[4.5rem] w-28 sm:h-24 sm:w-36'
      : size === 'sm'
        ? 'h-9 w-14'
        : 'h-11 w-16';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/25',
        box,
      )}
      title={logo.name}
    >
      <img
        src={`${PRESENTACION_LOGOS}/${logo.file}`}
        alt={logo.name}
        className="max-h-[82%] max-w-[88%] object-contain"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

function SlideShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-20',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300/90">
      {children}
    </p>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
      {children}
    </h2>
  );
}

function SlideBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200 sm:text-xl',
        className,
      )}
    >
      {children}
    </p>
  );
}

function TitleSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell className="items-start sm:items-center sm:text-center">
      <div className="flex max-w-3xl flex-col gap-6 sm:items-center">
        <div className="flex items-center gap-5 sm:flex-col sm:gap-6">
          <img
            src={MALI_MARK_URL}
            alt=""
            className="login-logo-glow h-28 w-28 object-contain sm:h-36 sm:w-36 md:h-44 md:w-44"
            draggable={false}
          />
          <div className="sm:text-center">
            {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
              {slide.title}
            </h1>
          </div>
        </div>
        {slide.subtitle ? (
          <p className="text-xl font-medium text-zinc-100 sm:text-2xl md:text-3xl">
            {slide.subtitle}
          </p>
        ) : null}
        {slide.body ? <SlideBody className="mt-0 sm:mx-auto">{slide.body}</SlideBody> : null}
        <p className="text-sm text-zinc-400">
          Usa ← → o espacio para avanzar · F pantalla completa
        </p>
      </div>
    </SlideShell>
  );
}

function ToolsSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell>
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <SlideTitle>{slide.title}</SlideTitle>
      {slide.body ? <SlideBody>{slide.body}</SlideBody> : null}
      <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
        {slide.logos?.map((logo) => (
          <div
            key={logo.id}
            className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/15 backdrop-blur-sm sm:p-4"
          >
            <ToolLogo logo={logo} size="lg" />
            <span className="text-center text-xs font-medium text-zinc-100 sm:text-sm">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function ValuesSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell>
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <SlideTitle>{slide.title}</SlideTitle>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {slide.values?.map((item, i) => (
          <div
            key={item.title}
            className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/15 backdrop-blur-sm sm:p-6"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sm font-bold text-sky-300">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold text-white sm:text-xl">
                {item.title}
              </h3>
            </div>
            <p className="text-base leading-relaxed text-zinc-200 sm:text-lg">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function DiagramSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell className="justify-start pt-10 sm:justify-center sm:pt-16">
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <SlideTitle>{slide.title}</SlideTitle>
      {slide.image ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
          <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-white/25 sm:p-4">
            <img
              src={`${PRESENTACION_ASSETS}/${slide.image}`}
              alt={slide.title}
              className="mx-auto max-h-[min(52vh,560px)] w-full object-contain"
              draggable={false}
            />
          </div>
          {slide.caption ? (
            <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-zinc-200 sm:text-lg">
              {slide.caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </SlideShell>
  );
}

function GroupSlide({ slide }: { slide: PresentacionSlide }) {
  const count = slide.modules?.length ?? 0;
  const cols =
    count <= 2
      ? 'sm:grid-cols-2'
      : count === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <SlideShell className="justify-start pt-10 sm:justify-center sm:pt-14">
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <SlideTitle>{slide.title}</SlideTitle>
      {slide.groupSummary ? (
        <SlideBody>{slide.groupSummary}</SlideBody>
      ) : null}
      <div className={cn('mt-8 grid gap-3 sm:gap-4', cols)}>
        {slide.modules?.map((mod) => {
          const styles = moduleCardAccentStyles[mod.accent];
          return (
            <div
              key={mod.id}
              className={cn(
                'rounded-2xl bg-gradient-to-t to-white/5 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:p-5',
                styles.gradient,
              )}
            >
              <div
                className={cn(
                  'mb-3 h-1.5 w-10 rounded-full',
                  styles.icon.split(' ')[0],
                )}
                aria-hidden
              />
              <h3 className="mb-2 text-base font-semibold text-white sm:text-lg">
                {mod.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-200 sm:text-[0.95rem]">
                {mod.description}
              </p>
              {mod.replaces && mod.replaces.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {mod.replaces.map((logo) => (
                    <ToolLogo key={logo.id} logo={logo} size="sm" />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

function RoadmapSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell>
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <SlideTitle>{slide.title}</SlideTitle>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {slide.roadmapItems?.map((item, i) => (
          <div
            key={item.title}
            className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/15 backdrop-blur-sm"
          >
            <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/25 text-sm font-bold text-violet-200">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mb-2 text-xl font-semibold text-white">
              {item.title}
            </h3>
            <p className="text-lg leading-relaxed text-zinc-200">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function ClosingSlide({ slide }: { slide: PresentacionSlide }) {
  return (
    <SlideShell className="items-center text-center">
      <img
        src={MALI_MARK_URL}
        alt=""
        className="login-logo-glow mb-8 h-28 w-28 object-contain sm:h-36 sm:w-36"
        draggable={false}
      />
      <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
        {slide.title}
      </h2>
      {slide.body ? (
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-200 sm:text-xl md:text-2xl">
          {slide.body}
        </p>
      ) : null}
      <Link
        to="/login"
        className="mt-10 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-zinc-900 transition hover:bg-zinc-100"
      >
        Ir al acceso MALI ONE
      </Link>
    </SlideShell>
  );
}

function renderSlide(slide: PresentacionSlide) {
  switch (slide.kind) {
    case 'title':
      return <TitleSlide slide={slide} />;
    case 'tools':
      return <ToolsSlide slide={slide} />;
    case 'values':
      return <ValuesSlide slide={slide} />;
    case 'diagram':
      return <DiagramSlide slide={slide} />;
    case 'group':
      return <GroupSlide slide={slide} />;
    case 'roadmap':
      return <RoadmapSlide slide={slide} />;
    case 'closing':
      return <ClosingSlide slide={slide} />;
    default:
      return null;
  }
}

export function PresentacionPage() {
  const total = presentacionSlides.length;
  const [index, setIndex] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex((prev) => {
        if (prev === clamped) return prev;
        setAnimKey((k) => k + 1);
        return clamped;
      });
      setIndexOpen(false);
    },
    [total],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(total - 1);
    } else if (e.key === 'Escape') {
      setIndexOpen(false);
    } else if (e.key === 'i' || e.key === 'I') {
      setIndexOpen((v) => !v);
    } else if (e.key === 'f' || e.key === 'F') {
      void toggleFullscreen();
    }
  });

  async function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function onFs() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const slide = presentacionSlides[index];
  const progress = ((index + 1) / total) * 100;

  return (
    <div
      ref={rootRef}
      className="login-shell relative h-svh max-h-svh overflow-hidden text-zinc-50 select-none"
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 56) return;
        if (delta < 0) next();
        else prev();
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-ambient login-ambient-emerald opacity-55" />
        <div className="login-ambient login-ambient-violet opacity-55" />
        <div className="login-ambient login-ambient-blue opacity-55" />
        <div className="login-grid-overlay opacity-30" />
        <div className="absolute inset-0 bg-[#020615]/35" />
      </div>

      {/* Progress */}
      <div className="absolute inset-x-0 top-0 z-30 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src={MALI_MARK_URL}
            alt=""
            className="h-8 w-8 object-contain opacity-90 sm:h-9 sm:w-9"
            draggable={false}
          />
          <span className="hidden text-sm font-medium text-zinc-200 sm:inline">
            MALI ONE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIndexOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 ring-1 ring-white/15 transition hover:bg-white/10"
            aria-label="Abrir índice"
          >
            <List className="size-4" />
            <span className="hidden sm:inline">Índice</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center justify-center rounded-lg bg-white/5 p-2 text-zinc-100 ring-1 ring-white/15 transition hover:bg-white/10"
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Slide stage */}
      <div className="relative z-10 h-full pb-16 pt-12">
        <div
          key={animKey}
          className="h-full animate-[presentacion-enter_320ms_ease-out]"
        >
          {renderSlide(slide)}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 px-4 pb-4 sm:px-6">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
            {presentacionSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a ${s.navLabel}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-white/35 hover:bg-white/60',
                )}
              />
            ))}
          </div>
          <p className="text-xs font-medium tabular-nums text-zinc-300">
            {index + 1} / {total}
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-zinc-400">{slide.navLabel}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={next}
          disabled={index === total - 1}
          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Click zones (desktop) */}
      <button
        type="button"
        aria-label="Slide anterior"
        className="absolute inset-y-16 left-0 z-20 hidden w-[12%] cursor-w-resize md:block"
        onClick={prev}
      />
      <button
        type="button"
        aria-label="Slide siguiente"
        className="absolute inset-y-16 right-0 z-20 hidden w-[12%] cursor-e-resize md:block"
        onClick={next}
      />

      {/* Index drawer */}
      {indexOpen ? (
        <div className="absolute inset-0 z-40 flex">
          <button
            type="button"
            className="flex-1 bg-black/55 backdrop-blur-sm"
            aria-label="Cerrar índice"
            onClick={() => setIndexOpen(false)}
          />
          <aside className="flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0a1228]/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Índice
                </p>
                <p className="text-lg font-semibold text-white">
                  {total} slides
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIndexOpen(false)}
                className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ol className="space-y-1">
                {presentacionSlides.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition',
                        i === index
                          ? 'bg-white/15 text-white ring-1 ring-white/20'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium leading-snug">
                        {s.navLabel}
                        {s.kind !== 'title' && s.title !== s.navLabel ? (
                          <span className="mt-0.5 block text-xs font-normal text-zinc-400">
                            {s.title}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        </div>
      ) : null}

      <style>{`
        @keyframes presentacion-enter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MALI_MARK_NAVY, MALI_MARK_VIEW_BOX, maliMarkPanelPaths } from '@/lib/mali-mark-geometry';

/** M de vidrio: favicon, PWA, login. */
export const MALI_MARK_URL = '/favicon.svg';

function MaliMarkSvg({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const glass = `${uid}-glass`;
  const edge = `${uid}-edge`;
  const letterGlass = `${uid}-letter`;
  const panelFx = `${uid}-panelFx`;
  const letterFx = `${uid}-letterFx`;
  const navyBg = `${uid}-navy`;

  const panels = (key: string) =>
    maliMarkPanelPaths.map((panel) => (
      <path key={`${key}-${panel.d}`} d={panel.d} transform={panel.transform} />
    ));

  return (
    <svg
      viewBox={MALI_MARK_VIEW_BOX}
      className={className}
      aria-hidden
      overflow="hidden"
    >
      <defs>
        <radialGradient id={navyBg} cx="50%" cy="45%" r="72%">
          <stop offset="0" stopColor={MALI_MARK_NAVY.inner} />
          <stop offset="0.52" stopColor={MALI_MARK_NAVY.mid} />
          <stop offset="1" stopColor={MALI_MARK_NAVY.outer} />
        </radialGradient>
        <linearGradient id={glass} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--mali-glass-0)" stopOpacity=".22" />
          <stop offset=".35" stopColor="var(--mali-glass-1)" stopOpacity=".30" />
          <stop offset=".72" stopColor="var(--mali-glass-2)" stopOpacity=".25" />
          <stop offset="1" stopColor="var(--mali-glass-3)" stopOpacity=".30" />
        </linearGradient>
        <linearGradient id={edge} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--mali-edge-0)" />
          <stop offset=".38" stopColor="var(--mali-edge-1)" />
          <stop offset=".7" stopColor="var(--mali-edge-2)" />
          <stop offset="1" stopColor="var(--mali-edge-3)" />
        </linearGradient>
        <linearGradient id={letterGlass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--mali-letter-0)" stopOpacity=".92" />
          <stop offset=".42" stopColor="var(--mali-letter-1)" stopOpacity=".62" />
          <stop offset="1" stopColor="var(--mali-letter-2)" stopOpacity=".70" />
        </linearGradient>
        <filter
          id={panelFx}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
          <feFlood floodColor="var(--mali-glow-panel)" floodOpacity=".68" result="blue" />
          <feComposite in="blue" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={letterFx}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.3" result="blur" />
          <feFlood floodColor="var(--mali-glow-letter)" floodOpacity=".75" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feSpecularLighting
            in="SourceAlpha"
            surfaceScale="4"
            specularConstant=".75"
            specularExponent="18"
            lightingColor="#ffffff"
            result="spec"
          >
            <fePointLight x="180" y="90" z="170" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="specClip" />
          </feMerge>
        </filter>
      </defs>

      <rect x="54" y="54" width="576" height="576" fill={`url(#${navyBg})`} />
      <ellipse
        cx="175"
        cy="472"
        rx="210"
        ry="205"
        fill={MALI_MARK_NAVY.orbBlue}
        opacity="0.09"
      />
      <ellipse
        cx="554"
        cy="197"
        rx="190"
        ry="185"
        fill={MALI_MARK_NAVY.orbViolet}
        opacity="0.08"
      />

      <g
        fill={`url(#${glass})`}
        stroke={`url(#${edge})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
        filter={`url(#${panelFx})`}
      >
        {panels('glass')}
      </g>

      <g
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".22"
        strokeWidth=".9"
        strokeLinejoin="round"
      >
        {panels('shine')}
      </g>

      <g
        fill={`url(#${letterGlass})`}
        stroke={`url(#${edge})`}
        strokeWidth=".72"
        strokeLinejoin="round"
        filter={`url(#${letterFx})`}
      >
        <path
          d="M 0,0 V 19.147 L 48.447,33.842 V 34.02 L 0,47.735 V 67.328 H 65.902 V 53.346 H 20.929 v -0.179 c 5.699,-0.979 9.884,-2.227 14.694,-3.65 L 65.902,39.631 V 26.806 L 35.623,17.009 C 30.636,15.497 27.785,14.604 20.216,13.181 V 13.002 H 65.902 V 0 Z"
          transform="matrix(1.3333333,0,0,-1.3333333,100.49213,480.95973)"
        />
        <path
          d="M 0,0 -22.443,-7.571 V -7.748 L 0,-15.497 Z m -40.967,-14.161 v 13.804 l 66.17,23.335 V 8.282 L 10.509,3.383 v -22.442 l 14.694,-5.076 v -13.359 z"
          transform="matrix(1.3333333,0,0,-1.3333333,154.75773,331.81133)"
        />
        <path
          d="M 0,0 V 14.516 H 54.146 V 43.55 H 65.902 V 0 Z"
          transform="matrix(1.3333333,0,0,-1.3333333,100.49213,291.78787)"
        />
        <path
          d="m 75.369,360.72 h 65.902 V 346.292 H 75.369 Z"
          transform="matrix(1.3333333,0,0,-1.3333333,0,684.16)"
        />
      </g>
    </svg>
  );
}

/** Marca glassmorphism; el vidrio sigue el acento. */
export function MaliMark({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        'mali-mark flex shrink-0 items-center justify-center',
        className,
      )}
    >
      <MaliMarkSvg className={cn('size-full', imageClassName)} />
    </div>
  );
}

interface MaliLogoProps {
  className?: string;
  imageClassName?: string;
  showSubtitle?: boolean;
  linkToHome?: boolean;
  onNavigate?: () => void;
}

export function MaliLogo({
  className,
  imageClassName,
  showSubtitle = true,
  linkToHome = false,
  onNavigate,
}: MaliLogoProps) {
  const content = (
    <>
      <img
        src={MALI_MARK_URL}
        alt="MALI"
        className={cn('size-10 object-contain', imageClassName)}
      />
      {showSubtitle && (
        <p className="mt-2 text-xs text-muted">Operaciones internas</p>
      )}
    </>
  );

  if (linkToHome) {
    return (
      <Link to="/" onClick={onNavigate} className={cn('block px-2', className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn('px-2', className)}>{content}</div>;
}

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** M de vidrio: favicon, PWA, login y chrome de la app. */
export const MALI_MARK_URL = '/favicon.svg';

/** Marca con placa del acento elegido. */
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
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary',
        className,
      )}
    >
      <img
        src={MALI_MARK_URL}
        alt=""
        className={cn('size-full object-contain', imageClassName)}
      />
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

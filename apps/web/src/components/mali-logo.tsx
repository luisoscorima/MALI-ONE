import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const MALI_LOGO_URL =
  'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Blanco.png';

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
        src={MALI_LOGO_URL}
        alt="MALI"
        className={cn('h-10 w-auto object-contain', imageClassName)}
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

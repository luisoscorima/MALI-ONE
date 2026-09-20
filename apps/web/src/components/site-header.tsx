import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { getVisibleNavSections, isNavItemActive } from '@/lib/app-nav';
import { MaliMark } from '@/components/mali-logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

function SidebarLogoTrigger({ className }: { className?: string }) {
  const { toggleSidebar, openMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-sidebar="trigger"
      className={cn('size-9 shrink-0 p-0.5 md:hidden', className)}
      onClick={toggleSidebar}
      aria-label={openMobile ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={openMobile}
    >
      <MaliMark className="size-8" />
    </Button>
  );
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const activeItem = getVisibleNavSections(user)
    .flatMap((section) => section.items)
    .filter((item) => isNavItemActive(pathname, item))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:hidden">
      <SidebarLogoTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4!" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">MALI ONE</p>
        <p className="truncate text-xs text-muted-foreground">
          {activeItem?.label ?? 'Panel de operaciones'}
        </p>
      </div>
    </header>
  );
}

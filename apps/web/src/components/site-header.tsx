import { MaliMark } from '@/components/mali-logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

function SidebarLogoTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-sidebar="trigger"
      className={cn('size-9 shrink-0 p-0.5 md:hidden', className)}
      onClick={toggleSidebar}
      aria-label="Abrir menú"
    >
      <MaliMark className="size-8" />
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:hidden">
      <SidebarLogoTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4!" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">MALI ONE</p>
        <p className="truncate text-xs text-muted-foreground">
          Panel de operaciones
        </p>
      </div>
    </header>
  );
}

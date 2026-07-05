import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
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

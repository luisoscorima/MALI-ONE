import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export function AppLayout() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '16rem',
          '--header-height': '3rem',
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:outline-2 focus:outline-ring"
      >
        Saltar al contenido
      </a>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

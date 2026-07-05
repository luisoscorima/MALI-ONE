import { Link } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { MALI_LOGO_URL } from '@/components/mali-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { getVisibleNavSections } from '@/lib/app-nav';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth();
  const sections = getVisibleNavSections(user);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary ring-1 ring-sidebar-border">
                  <img
                    src={MALI_LOGO_URL}
                    alt=""
                    className="h-5 w-auto object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">MALI ONE</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Operaciones internas
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain sections={sections} />
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <NavUser user={user} onLogout={() => void logout()} />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

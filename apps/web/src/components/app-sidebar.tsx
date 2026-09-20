import { Link } from 'react-router-dom';
import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { MaliMark } from '@/components/mali-logo';
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
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const sections = getVisibleNavSections(user)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLocaleLowerCase().includes(query),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-14 p-1 [&_svg]:size-full" asChild>
              <Link to="/">
                <MaliMark className="size-12" />
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
        <label className="grid gap-1 px-1 text-xs text-muted-foreground">
          Buscar módulo
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre del módulo"
            className="min-w-0"
          />
        </label>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSearch('')}>
            Limpiar búsqueda
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <NavMain sections={sections} />
        {sections.length === 0 && (
          <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
            Sin módulos coincidentes.
          </p>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <NavUser user={user} onLogout={() => void logout()} />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

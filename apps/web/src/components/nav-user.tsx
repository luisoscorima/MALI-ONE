import {
  Check,
  EllipsisVertical,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { AuthUser } from '@mali-one/shared';
import { AccentThemeSwatches } from '@/components/accent-theme-picker';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

type Props = {
  user: AuthUser;
  onLogout: () => void;
};

function userInitials(name?: string | null) {
  if (!name?.trim()) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const active = theme === 'light' ? 'light' : 'dark';

  const options = [
    { id: 'dark' as const, label: 'Oscuro', icon: Moon },
    { id: 'light' as const, label: 'Claro', icon: Sun },
  ];

  if (compact) {
    return (
      <div className="flex flex-col gap-1 px-2 pb-2">
        {options.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4" />
            <span className="flex-1 text-left">{label}</span>
            {active === id ? <Check className="size-4" /> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      {options.map(({ id, label, icon: Icon }) => (
        <DropdownMenuItem key={id} onClick={() => setTheme(id)}>
          <Icon className="size-4" />
          {label}
          {active === id ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function NavUser({ user, onLogout }: Props) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.picture ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {userInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="z-[110] w-[--radix-dropdown-menu-trigger-width] min-w-56 max-w-[calc(100vw-1rem)] rounded-lg"
            side={isMobile ? 'top' : 'right'}
            align={isMobile ? 'start' : 'end'}
            sideOffset={4}
            collisionPadding={8}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.picture ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {userInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.isSuperAdmin && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                <Shield className="size-4" />
                Super administrador
              </DropdownMenuItem>
            )}
            {isMobile ? (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <Sun className="size-3.5" />
                  Apariencia
                </div>
                <AppearanceControls compact />
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <Palette className="size-3.5" />
                  Color de interfaz
                </div>
                <AccentThemeSwatches className="justify-center px-3 pb-2" />
              </>
            ) : (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sun className="size-4" />
                    Apariencia
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent collisionPadding={8}>
                    <AppearanceControls />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="size-4" />
                    Color de interfaz
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-0" collisionPadding={8}>
                    <AccentThemeSwatches />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

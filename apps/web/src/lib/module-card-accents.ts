export type ModuleCardAccent =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan';

export const moduleCardAccentStyles: Record<
  ModuleCardAccent,
  { icon: string; ring: string; glow: string; gradient: string }
> = {
  blue: {
    icon: 'bg-blue-500/20 text-blue-400',
    ring: 'group-hover:ring-blue-500/30',
    glow: 'group-hover:shadow-blue-500/10',
    gradient: 'from-blue-500/10',
  },
  violet: {
    icon: 'bg-violet-500/20 text-violet-400',
    ring: 'group-hover:ring-violet-500/30',
    glow: 'group-hover:shadow-violet-500/10',
    gradient: 'from-violet-500/10',
  },
  emerald: {
    icon: 'bg-emerald-500/20 text-emerald-400',
    ring: 'group-hover:ring-emerald-500/30',
    glow: 'group-hover:shadow-emerald-500/10',
    gradient: 'from-emerald-500/10',
  },
  amber: {
    icon: 'bg-amber-500/20 text-amber-400',
    ring: 'group-hover:ring-amber-500/30',
    glow: 'group-hover:shadow-amber-500/10',
    gradient: 'from-amber-500/10',
  },
  rose: {
    icon: 'bg-rose-500/20 text-rose-400',
    ring: 'group-hover:ring-rose-500/30',
    glow: 'group-hover:shadow-rose-500/10',
    gradient: 'from-rose-500/10',
  },
  cyan: {
    icon: 'bg-cyan-500/20 text-cyan-400',
    ring: 'group-hover:ring-cyan-500/30',
    glow: 'group-hover:shadow-cyan-500/10',
    gradient: 'from-cyan-500/10',
  },
};

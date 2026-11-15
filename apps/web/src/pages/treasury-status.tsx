import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { cn } from '@/lib/utils';

type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const tones: Record<StatusTone, { badge: string; dot: string }> = {
  success: { badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  info: { badge: 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  warning: { badge: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  danger: { badge: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  neutral: { badge: 'border-border bg-secondary text-secondary-foreground', dot: 'bg-muted-foreground' },
};

function statusTone(status: string): StatusTone {
  const key = status.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (['liquidada', 'pagado'].includes(key)) return 'success';
  if (key === 'autorizada') return 'info';
  if (key === 'por pagar') return 'warning';
  if (['anulada', 'denegada', 'expirado'].includes(key)) return 'danger';
  return 'neutral';
}

export function TreasuryStatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={tones[statusTone(status)].badge}>{status}</Badge>;
}

export function TreasuryStatusFilter({
  id,
  value,
  states,
  onChange,
}: {
  id: string;
  value: string;
  states: string[];
  onChange: (value: string) => void;
}) {
  return <div className="grid gap-1.5 text-sm">
    <label htmlFor={id} className="font-medium">Estado</label>
    <Select value={value || 'all'} onValueChange={next => onChange(next === 'all' ? '' : next)}>
      <SelectTrigger id={id} className="h-9 w-full rounded-md border-input bg-background px-3">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los estados</SelectItem>
        {states.map(status => <SelectItem key={status} value={status}>
          <span aria-hidden="true" className={cn('size-2 rounded-full', tones[statusTone(status)].dot)} />
          {status}
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

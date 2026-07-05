import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SectionModuleCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  groupLabel?: string;
};

type Props = {
  cards: SectionModuleCard[];
  className?: string;
};

export function SectionModuleCards({ cards, className }: Props) {
  return (
    <div
      className={cn(
        '*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card',
        'grid grid-cols-1 gap-4',
        '*:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs',
        '@xl/main:grid-cols-2 @5xl/main:grid-cols-3',
        className,
      )}
    >
      {cards.map((card) => (
        <Link key={card.to} to={card.to} className="group block h-full">
          <Card className="@container/card h-full transition-transform duration-200 group-hover:-translate-y-0.5">
            <CardHeader>
              {card.groupLabel && (
                <CardDescription>{card.groupLabel}</CardDescription>
              )}
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <card.icon className="size-4" />
                </span>
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">{card.description}</p>
              <ArrowUpRight className="size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}

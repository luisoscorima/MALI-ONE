import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export type PaginationItem = number | 'ellipsis';

/** Ventana con primera/última, vecinos y elipsis. */
export function buildPaginationItems(
  page: number,
  totalPages: number,
  siblingCount = 1,
): PaginationItem[] {
  const total = Math.max(0, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), Math.max(1, total));
  if (total <= 0) return [];
  if (total <= siblingCount * 2 + 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  const items: PaginationItem[] = [1];
  if (showLeftEllipsis) items.push('ellipsis');
  else {
    for (let p = 2; p < leftSibling; p += 1) items.push(p);
  }
  for (let p = leftSibling; p <= rightSibling; p += 1) {
    if (p !== 1 && p !== total) items.push(p);
  }
  if (showRightEllipsis) items.push('ellipsis');
  else {
    for (let p = rightSibling + 1; p < total; p += 1) items.push(p);
  }
  if (total > 1) items.push(total);
  return items;
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** Texto a la izquierda (p. ej. "120 en total"). */
  summary?: ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  siblingCount?: number;
  /** Si false, no renderiza nada cuando totalPages ≤ 1 y no hay pageSize. */
  showWhenSinglePage?: boolean;
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  summary,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
  siblingCount = 1,
  showWhenSinglePage = false,
}: PaginationProps) {
  const pages = Math.max(0, totalPages);
  const current = pages === 0 ? 0 : Math.min(Math.max(1, page), pages);
  const hasPageSize = Boolean(onPageSizeChange && pageSize != null);
  const showNav = pages > 1 || (showWhenSinglePage && pages === 1);

  if (!showNav && !hasPageSize && !summary) return null;
  if (!showNav && !hasPageSize && summary) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          className,
        )}
      >
        <div className="text-sm text-muted-foreground">{summary}</div>
      </div>
    );
  }

  const items = buildPaginationItems(current || 1, Math.max(pages, 1), siblingCount);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <div className="text-sm text-muted-foreground">{summary ?? null}</div>
      <div className="flex flex-wrap items-center gap-3">
        {hasPageSize ? (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Por página</Label>
            <Select
              value={String(pageSize)}
              disabled={disabled}
              onValueChange={(value) => onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showNav ? (
          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="Paginación"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || current <= 1 || pages === 0}
              onClick={() => onPageChange(Math.max(1, current - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {items.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`e-${index}`}
                  className="px-1.5 text-sm text-muted-foreground select-none"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={item === current ? 'default' : 'outline'}
                  disabled={disabled || pages === 0}
                  aria-label={`Página ${item}`}
                  aria-current={item === current ? 'page' : undefined}
                  className="min-w-8 px-2"
                  onClick={() => {
                    if (item !== current) onPageChange(item);
                  }}
                >
                  {item}
                </Button>
              ),
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || pages === 0 || current >= pages}
              onClick={() => onPageChange(Math.min(pages, current + 1))}
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

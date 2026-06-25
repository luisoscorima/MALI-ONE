import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'danger';
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'default' && 'bg-primary text-primary-foreground hover:opacity-90',
        variant === 'outline' &&
          'border border-border bg-transparent hover:bg-border/40',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary',
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-6', className)}>
      {children}
    </div>
  );
}

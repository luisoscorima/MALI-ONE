import type { ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export type ToastType = 'success' | 'error' | 'info';

const toastApi = {
  toast: (message: string, type: ToastType = 'info') => {
    if (type === 'success') sonnerToast.success(message);
    else if (type === 'error') sonnerToast.error(message);
    else sonnerToast.info(message);
  },
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function useToast() {
  return toastApi;
}

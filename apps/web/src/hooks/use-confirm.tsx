import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { notifyFloatingLayerOpen } from '@/lib/floating-layer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive' | 'danger';
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const EMPTY_OPTIONS: ConfirmOptions = {
  title: '',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>(EMPTY_OPTIONS);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const layerRegisteredRef = useRef(false);

  const releaseFloatingLayer = useCallback(() => {
    if (!layerRegisteredRef.current) return;
    layerRegisteredRef.current = false;
    notifyFloatingLayerOpen(false);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(next);
      // Diferir la apertura para que el click del trigger (p. ej. Tooltip)
      // termine antes de montar el overlay; evita overlay huérfano en SPA.
      queueMicrotask(() => setOpen(true));
    });
  }, []);

  const settle = useCallback(
    (result: boolean) => {
      // Sync release so the same Escape/click cannot dismiss a parent Dialog.
      releaseFloatingLayer();
      resolveRef.current?.(result);
      resolveRef.current = null;
      setOpen(false);
    },
    [releaseFloatingLayer],
  );

  useEffect(() => {
    if (!open) {
      releaseFloatingLayer();
      return;
    }
    if (!layerRegisteredRef.current) {
      layerRegisteredRef.current = true;
      notifyFloatingLayerOpen(true);
    }
    return () => releaseFloatingLayer();
  }, [open, releaseFloatingLayer]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const actionVariant =
    options.variant === 'danger' || options.variant === 'destructive'
      ? 'destructive'
      : 'default';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            {options.description ? (
              <AlertDialogDescription>
                {options.description}
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription className="sr-only">
                Confirmar acción
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {options.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={actionVariant}
              onClick={() => settle(true)}
            >
              {options.confirmLabel ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  }
  return ctx.confirm;
}

import { create } from 'zustand';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((ok: boolean) => void) | null;
  show: (options: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  show: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

/** Promise-based confirm() replacement — `if (await confirmDialog({...})) { ... }`. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(options);
}

/** Mounted once in AppLayout. Renders the active confirm prompt as a shadcn AlertDialog. */
export function ConfirmDialog() {
  const { open, options, close } = useConfirmStore();
  const {
    title = 'Are you sure?',
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive,
  } = options;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
            onClick={() => close(true)}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

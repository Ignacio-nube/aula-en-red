import type { ReactNode } from 'react';
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

export interface PedidoConfirmacion {
  titulo: string;
  descripcion: ReactNode;
  accion: string;
  destructiva?: boolean;
  onConfirmar: () => void | Promise<void>;
}

/** Confirmación controlada: se abre cuando `pedido` no es null. */
export function Confirmar({ pedido, onCerrar }: { pedido: PedidoConfirmacion | null; onCerrar: () => void }) {
  return (
    <AlertDialog open={pedido !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{pedido?.descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={pedido?.destructiva ? 'destructive' : 'default'} onClick={() => void pedido?.onConfirmar()}>
            {pedido?.accion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

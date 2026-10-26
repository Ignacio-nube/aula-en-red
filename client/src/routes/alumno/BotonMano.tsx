import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import type { MiMano } from '@aula/shared';
import { Pin } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { emitirConAck } from '@/lib/juego';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';

const RESORTE = { type: 'spring', stiffness: 420, damping: 30 } as const;

/** La manito dentro del pin. Saluda sola mientras la mano está levantada. */
function Manito({ saludando, tamano }: { saludando: boolean; tamano: number }) {
  return (
    <Pin tamano={tamano} color={saludando ? 'var(--pd-blanco)' : 'var(--pd-celeste)'}>
      <motion.span
        className="inline-block"
        style={{ originX: 0.6, originY: 0.9 }}
        animate={saludando ? { rotate: [0, 20, -6, 20, 0] } : { rotate: 0 }}
        transition={saludando ? { duration: 1.2, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' } : RESORTE}
        aria-hidden
      >
        ✋
      </motion.span>
    </Pin>
  );
}

/** Levantar o bajar la mano. El profe la ve en su fila, en orden de llegada. */
export function BotonMano({ socket, mano, className }: { socket: SocketAula | null; mano: MiMano; className?: string }) {
  const [enviando, setEnviando] = useState(false);

  const cambiar = async (arriba: boolean) => {
    setEnviando(true);
    const r = await emitirConAck(socket, 'mano:cambiar', arriba);
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className={cn('flex', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {mano.arriba ? (
          <motion.div
            key="arriba"
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={RESORTE}
            className="flex items-center gap-2 rounded-full bg-pd-celeste-oscuro py-1.5 pr-2 pl-2.5 text-white shadow-[var(--pd-sombra-flotante)] sm:gap-3 sm:pl-3"
            role="status"
          >
            <Manito saludando tamano={30} />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold sm:text-base">Levantaste la mano</span>
              <span className="text-xs text-white sm:text-sm">
                {(mano.puesto ?? 1) <= 1 ? 'Te toca primero' : mano.puesto === 2 ? 'Hay 1 antes que vos' : `Hay ${(mano.puesto ?? 1) - 1} antes que vos`}
              </span>
            </span>
            <Button variant="secondary" size="sm" className="ml-1" disabled={enviando} onClick={() => void cambiar(false)}>
              Bajarla
            </Button>
          </motion.div>
        ) : (
          <motion.button
            key="abajo"
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover="hover"
            whileTap={{ scale: 0.95 }}
            transition={RESORTE}
            disabled={enviando}
            onClick={() => void cambiar(true)}
            className="vidrio flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-3 text-sm font-semibold whitespace-nowrap sm:pr-5 sm:text-base shadow-[var(--pd-sombra-flotante)] ring-1 ring-foreground/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <motion.span variants={{ hover: { rotate: [0, 16, -6, 12, 0], transition: { duration: 0.7 } } }} className="inline-flex">
              <Manito saludando={false} tamano={30} />
            </motion.span>
            Levantar la mano
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

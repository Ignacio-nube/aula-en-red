import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun, SunMoon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cambiarTema, NOMBRE_TEMA, siguienteTema, useTema } from '@/lib/tema';

const ICONO = { auto: SunMoon, claro: Sun, oscuro: Moon } as const;

/** Cambia entre automático, claro y oscuro. Queda guardado en esta compu. */
export function BotonTema() {
  const { preferencia } = useTema();
  const Icono = ICONO[preferencia];
  const proximo = siguienteTema(preferencia);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema: ${NOMBRE_TEMA[preferencia]}. Cambiar a ${NOMBRE_TEMA[proximo]}`} onClick={() => cambiarTema(proximo)}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={preferencia}
              className="inline-flex"
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            >
              <Icono />
            </motion.span>
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Tema: {NOMBRE_TEMA[preferencia]}</TooltipContent>
    </Tooltip>
  );
}

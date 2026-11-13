import { AnimatePresence, motion } from 'motion/react';
import { Estanque } from '@/components/estanque/Estanque';
import { claseFondo, type Fondo } from '@/lib/fondo';
import { useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';
import { Aurora } from './Aurora';
import { Espacio } from './Espacio';

interface Props {
  fondo: Fondo;
  /** Sin canvas (modo liviano): queda solo el color del fondo, quieto. */
  quieto?: boolean;
  /** Deja de moverse (mientras se elige el emoji). */
  pausado?: boolean;
  /** Más apagado, para que no compita con lo de adelante. */
  apagado?: boolean;
}

/** El fondo de la sala de espera que eligió el alumno. Al cambiarlo, uno se funde con el otro. */
export function FondoEspera({ fondo, quieto = false, pausado = false, apagado = false }: Props) {
  const { oscuro } = useTema();
  const lienzo = cn('absolute inset-0 size-full transition-opacity duration-300', apagado && 'opacity-30');
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={fondo}
        className={cn('absolute inset-0', claseFondo(fondo, oscuro))}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
      >
        {!quieto && fondo === 'estanque' && <Estanque className={lienzo} pausado={pausado} />}
        {!quieto && fondo === 'espacio' && <Espacio className={lienzo} pausado={pausado} />}
        {!quieto && fondo === 'aurora' && <Aurora className={lienzo} pausado={pausado} />}
      </motion.div>
    </AnimatePresence>
  );
}

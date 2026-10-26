import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Silueta de pin (marcador de mapa) que se usa como motivo: marco de avatares,
// loader, mano levantada y podio. Es un marco propio: el logo nunca se redibuja.
const SILUETA =
  'M24 1.5C11.57 1.5 1.5 11.57 1.5 24c0 15.2 18.4 31.1 20.9 33.2a2.5 2.5 0 0 0 3.2 0C28.1 55.1 46.5 39.2 46.5 24 46.5 11.57 36.43 1.5 24 1.5Z';

interface PinProps {
  /** Ancho en px; el alto sale de la proporción del pin (48 × 60). */
  tamano?: number;
  color?: string;
  children?: ReactNode;
  className?: string;
}

export function Pin({ tamano = 48, color = 'var(--pd-celeste)', children, className }: PinProps) {
  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: tamano, height: tamano * 1.25 }}
    >
      <svg viewBox="0 0 48 60" className="absolute inset-0 size-full drop-shadow-[0_3px_6px_rgb(11_125_176/0.25)]" aria-hidden>
        <path d={SILUETA} fill={color} />
        <circle cx="24" cy="24" r="16.5" fill="#fff" />
      </svg>
      {children !== undefined && (
        <span
          className="absolute flex items-center justify-center leading-none select-none"
          // El círculo blanco está centrado en (24, 24) de un lienzo de 48 × 60.
          style={{ left: '50%', top: '40%', translate: '-50% -50%', fontSize: tamano * 0.42, width: tamano * 0.66, height: tamano * 0.66 }}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Avatar del alumno: su emoji dentro del pin. */
export function PinAvatar({ avatar, tamano = 48, className }: { avatar: string; tamano?: number; className?: string }) {
  return (
    <Pin tamano={tamano} className={className}>
      <span role="img" aria-hidden>
        {avatar}
      </span>
    </Pin>
  );
}

/** Loader de la sala de espera: un pin que rebota suave, con su sombra en el piso. */
export function PinLoader({ tamano = 64, className }: { tamano?: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex flex-col items-center', className)} role="status" aria-label="Esperando">
      <motion.span
        animate={{ y: [0, -tamano * 0.35, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: [0.45, 0, 0.55, 1], times: [0, 0.5, 1] }}
      >
        <Pin tamano={tamano}>
          <span className="block rounded-full bg-pd-celeste/25" style={{ width: tamano * 0.22, height: tamano * 0.22 }} />
        </Pin>
      </motion.span>
      <motion.span
        className="mt-1 rounded-[50%] bg-pd-celeste-oscuro/15"
        style={{ width: tamano * 0.6, height: tamano * 0.12 }}
        animate={{ scaleX: [1, 0.6, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: [0.45, 0, 0.55, 1], times: [0, 0.5, 1] }}
      />
    </span>
  );
}

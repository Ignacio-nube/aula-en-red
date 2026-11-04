import type { Transition } from 'motion/react';

/**
 * Los resortes de la app, con nombre. Así todo se mueve con el mismo carácter en vez de tener un
 * stiffness/damping distinto en cada archivo. El modo liviano y prefers-reduced-motion los apagan
 * desde MotionConfig (main.tsx).
 */
export const MOVIMIENTO = {
  /** Cambios de lugar y de pantalla: llega firme, sin rebote. */
  suave: { type: 'spring', stiffness: 340, damping: 34, mass: 1 },
  /** Respuesta a un toque: rápido y corto. */
  rapido: { type: 'spring', stiffness: 560, damping: 36 },
  /** Algo que aparece para celebrar (pins, medallas, números): un rebote. */
  rebote: { type: 'spring', stiffness: 380, damping: 17 },
  /** Barras y columnas que crecen: lento y con peso. */
  crecer: { type: 'spring', stiffness: 120, damping: 20, mass: 1.1 },
  /** Salida: no compite con lo que entra. */
  salida: { duration: 0.16, ease: [0.4, 0, 1, 1] },
} satisfies Record<string, Transition>;

/** Demora para que los elementos de una lista entren uno detrás de otro. */
export function escalon(i: number, paso = 0.06, inicio = 0.1): number {
  return inicio + Math.min(i, 12) * paso;
}

/** Vibración corta en el celu (si el navegador la soporta y no se pidió menos movimiento). */
export function vibrar(patron: number | number[]): void {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(patron);
  } catch {
    // Algunos navegadores tiran error si no hubo un toque antes; da igual.
  }
}

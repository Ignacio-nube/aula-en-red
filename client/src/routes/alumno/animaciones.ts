import type { Variants } from 'motion/react';

/** Entrada escalonada para listas (comisiones, nombres). */
export const lista: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

export const item: Variants = {
  oculto: { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } },
};

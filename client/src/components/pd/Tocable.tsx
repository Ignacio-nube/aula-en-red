import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

/** Superficie grande que se "hunde" con un resorte al tocarla (tarjetas de comisión, nombres). */
export function Tocable({ className, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'rounded-3xl bg-card text-left shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 hover:shadow-[var(--pd-sombra-flotante)]',
        className,
      )}
      {...props}
    />
  );
}

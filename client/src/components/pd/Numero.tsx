import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { formatoPuntos } from '@/lib/juego';

/** Contador de puntos que sube animado desde el valor anterior. */
export function Numero({ valor, desde, duracion = 1.1, className }: { valor: number; desde?: number; duracion?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previo = useRef(desde ?? valor);
  const reducir = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inicio = previo.current;
    previo.current = valor;
    if (reducir || inicio === valor) {
      el.textContent = formatoPuntos(valor);
      return;
    }
    const control = animate(inicio, valor, {
      duration: duracion,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = formatoPuntos(Math.round(v))),
    });
    return () => control.stop();
  }, [valor, duracion, reducir]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatoPuntos(desde ?? valor)}
    </span>
  );
}

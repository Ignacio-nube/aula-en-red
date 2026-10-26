import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Barra superior de vidrio esmerilado, fija arriba al hacer scroll. Publica su alto en
 * `--alto-barra` para que otras barras fijas (como la del editor) se ubiquen justo debajo.
 */
export function BarraVidrio({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => document.documentElement.style.setProperty('--alto-barra', `${el.offsetHeight}px`);
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className={cn(
        'vidrio sticky top-0 z-30 border-b border-foreground/5 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset]',
        className,
      )}
    >
      {children}
    </header>
  );
}

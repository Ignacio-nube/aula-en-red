import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Spinner } from '@/components/ui/spinner';
import { dibujarPagina, type Tamano } from '@/lib/pdf';
import { cn } from '@/lib/utils';

/** Un lienzo ya dibujado puede estar mostrándose en otro lado: en ese caso se copia. */
function copiar(origen: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = origen.width;
  c.height = origen.height;
  c.style.width = origen.style.width;
  c.style.height = origen.style.height;
  c.getContext('2d')?.drawImage(origen, 0, 0);
  return c;
}

/** Mide la caja y avisa cuando cambia de tamaño (esperando a que termine de cambiar). */
function useTamano(ref: RefObject<HTMLElement | null>): Tamano | null {
  const [tamano, setTamano] = useState<Tamano | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let espera = 0;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 8 || height < 8) return;
      setTamano((t) => (t && Math.abs(t.ancho - width) < 2 && Math.abs(t.alto - height) < 2 ? t : { ancho: width, alto: height }));
    };
    medir();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(espera);
      espera = window.setTimeout(medir, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(espera);
    };
  }, [ref]);
  return tamano;
}

interface Props {
  doc: PDFDocumentProxy | null;
  url: string;
  pagina: number;
  /** Páginas para dibujar por adelantado (por ejemplo, la siguiente), así el cambio es instantáneo. */
  precargar?: number[];
  className?: string;
  /** Clases del marco que rodea la diapositiva (sombra, bordes). */
  claseMarco?: string;
  etiqueta?: string;
}

/**
 * Una página del PDF, lo más grande posible dentro de su caja y sin deformarse. Mientras se dibuja
 * la nueva, queda la anterior en pantalla: nunca parpadea en blanco.
 */
export function Diapositiva({ doc, url, pagina, precargar = [], className, claseMarco, etiqueta }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const tamano = useTamano(caja);
  const [dibujada, setDibujada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const aPrecargar = precargar.join(',');

  useEffect(() => {
    if (!doc || !tamano) return;
    let vivo = true;
    dibujarPagina(doc, url, pagina, tamano).then(
      (canvas) => {
        const destino = marco.current;
        if (!vivo || !destino) return;
        destino.replaceChildren(canvas.parentElement && canvas.parentElement !== destino ? copiar(canvas) : canvas);
        setDibujada(true);
        setFallo(false);
        for (const p of aPrecargar.split(',').map(Number)) {
          if (p >= 1 && p <= doc.numPages) dibujarPagina(doc, url, p, tamano).catch(() => {});
        }
      },
      () => vivo && setFallo(true),
    );
    return () => {
      vivo = false;
    };
  }, [doc, url, pagina, tamano, aPrecargar]);

  return (
    <div ref={caja} className={cn('relative grid size-full min-h-0 min-w-0 place-items-center overflow-hidden', className)}>
      <div
        ref={marco}
        role="img"
        aria-label={etiqueta ?? `Diapositiva ${pagina}`}
        className={cn('overflow-hidden bg-white [&>canvas]:block', !dibujada && 'hidden', claseMarco)}
      />
      {!dibujada && !fallo && <Spinner className="absolute size-8 text-pd-celeste-oscuro" />}
      {fallo && <p className="absolute px-4 text-center text-muted-foreground">No se pudo mostrar esta diapositiva.</p>}
    </div>
  );
}

/** Miniatura que se dibuja recién cuando aparece en pantalla (una tira de 40 no traba la compu). */
export function Miniatura(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entradas) => entradas.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return (
    <div ref={ref} className="size-full">
      {visible && <Diapositiva {...props} />}
    </div>
  );
}

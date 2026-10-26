import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
import type { EstadoPresentacion, MiMano } from '@aula/shared';
import { Diapositiva } from '@/components/pd/Diapositiva';
import { Button } from '@/components/ui/button';
import { urlPresentacion, useDocumentoPdf } from '@/lib/pdf';
import type { SocketAula } from '@/lib/socket';
import { BarraParticipacion } from './BarraParticipacion';

/**
 * La diapositiva que está pasando el profe. En modo libre el alumno se puede mover por su cuenta;
 * mientras no se mueva, sigue al profe.
 */
export function PresentacionAlumno({ estado, socket, mano }: { estado: EstadoPresentacion; socket: SocketAula | null; mano: MiMano }) {
  const url = urlPresentacion(estado.archivo);
  const { doc, error } = useDocumentoPdf(url);
  /** Página elegida por el alumno en modo libre (null = sigue al profe). */
  const [propia, setPropia] = useState<number | null>(null);
  const inicioDedo = useRef<number | null>(null);

  useEffect(() => {
    if (!estado.libre) setPropia(null);
  }, [estado.libre]);
  useEffect(() => setPropia(null), [estado.presentacionId]);

  const pagina = estado.libre && propia !== null ? propia : estado.pagina;
  const separado = pagina !== estado.pagina;

  const ir = (p: number) => {
    const nueva = Math.min(Math.max(p, 1), estado.paginas);
    setPropia(nueva === estado.pagina ? null : nueva);
  };

  useEffect(() => {
    if (!estado.libre) return;
    const teclas = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).closest('input, textarea')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown') ir(pagina + 1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') ir(pagina - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 sm:px-6">
      <div
        className="relative min-h-0 flex-1 touch-pan-y"
        // En modo libre, deslizar el dedo a los costados también pasa las diapositivas.
        onPointerDown={(ev) => {
          inicioDedo.current = ev.pointerType === 'touch' ? ev.clientX : null;
        }}
        onPointerUp={(ev) => {
          if (!estado.libre || inicioDedo.current === null) return;
          const dx = ev.clientX - inicioDedo.current;
          inicioDedo.current = null;
          if (Math.abs(dx) > 50) ir(pagina + (dx < 0 ? 1 : -1));
        }}
      >
        {error ? (
          <p className="grid h-full place-items-center text-lg text-muted-foreground">No se pudo abrir la presentación. Avisale al profe.</p>
        ) : (
          <Diapositiva
            doc={doc}
            url={url}
            pagina={pagina}
            precargar={[pagina + 1, estado.pagina, pagina - 1]}
            claseMarco="rounded-2xl shadow-[var(--pd-sombra-flotante)] ring-1 ring-foreground/5"
          />
        )}
        {/* En el celu parado la diapositiva queda chica: sugerir girarlo. */}
        <p className="pointer-events-none absolute inset-x-0 bottom-2 hidden text-center text-sm text-muted-foreground max-sm:portrait:block">
          Girá el celu para verla más grande
        </p>
      </div>

      {/* En la compu: mano | navegación | volver. En el celu parado: volver arriba, ocupando todo el ancho. */}
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
        <AnimatePresence>
          {estado.libre && separado && (
            <motion.div
              key="volver"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="order-first w-full sm:order-last sm:col-start-3 sm:row-start-1 sm:flex sm:w-auto sm:justify-end"
            >
              <Button size="lg" className="w-full sm:w-auto" onClick={() => setPropia(null)}>
                <Undo2 data-icon="inline-start" />
                Volver con el profe
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <BarraParticipacion socket={socket} mano={mano} className="sm:col-start-1 sm:row-start-1" />

        {estado.libre ? (
          <div className="vidrio flex items-center gap-1 rounded-full p-1 shadow-[var(--pd-sombra-tarjeta)] sm:col-start-2 sm:row-start-1">
            <Button variant="ghost" size="icon" aria-label="Diapositiva anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-14 text-center font-semibold tabular-nums sm:min-w-20">
              {pagina} / {estado.paginas}
            </span>
            <Button variant="ghost" size="icon" aria-label="Diapositiva siguiente" disabled={pagina >= estado.paginas} onClick={() => ir(pagina + 1)}>
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground tabular-nums sm:col-start-2 sm:row-start-1">
            <span className="max-sm:hidden">Diapositiva </span>
            {pagina} <span className="max-sm:hidden">de</span>
            <span className="sm:hidden">/</span> {estado.paginas}
          </span>
        )}

        {estado.libre && !separado && (
          <span className="hidden justify-self-end rounded-full bg-pd-celeste-claro px-3 py-1 text-sm font-medium sm:col-start-3 sm:row-start-1 sm:block">
            Modo libre: podés moverte con las flechas o deslizando
          </span>
        )}
      </div>
    </div>
  );
}

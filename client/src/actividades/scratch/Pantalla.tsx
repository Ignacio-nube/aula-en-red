import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleAlert } from 'lucide-react';
import type { InfoServidor } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Spinner } from '@/components/ui/spinner';
import { MOVIMIENTO } from '@/lib/movimiento';
import { cn } from '@/lib/utils';
import type { EstadoDe } from '../tipos';
import { URL_REPRODUCTOR, useEditorScratch, type VmScratch } from './editor';

export function PantallaScratch({ estado }: { estado: EstadoDe<'scratch'>; recibido: number; info: InfoServidor | null }) {
  const v = estado.vista;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={v.mostrando ? `entrega-${v.mostrando.url}` : 'entregas'}
        className="flex h-full min-h-0 flex-col gap-[2vh]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, y: -30, transition: MOVIMIENTO.salida }}
      >
        {v.mostrando ? <Reproductor estado={estado} /> : <Entregas estado={estado} />}
      </motion.div>
    </AnimatePresence>
  );
}

/** Mientras no se muestra ninguna: quién ya entregó. */
function Entregas({ estado }: { estado: EstadoDe<'scratch'> }) {
  const v = estado.vista;
  return (
    <>
      <div className="flex items-baseline justify-between gap-[2vw]">
        <h1 className="truncate text-[clamp(1.8rem,3.4vw,4rem)] font-extrabold">{v.titulo}</h1>
        <p className="shrink-0 text-[clamp(1.2rem,2vw,2.4rem)] font-bold tabular-nums">
          {v.entregaron}
          <span className="text-muted-foreground">/{v.total} entregaron</span>
        </p>
      </div>
      <ul className="grid min-h-0 flex-1 content-start gap-[1.5vw] overflow-hidden [grid-template-columns:repeat(auto-fill,minmax(clamp(9rem,13vw,16rem),1fr))]">
        {v.entregas.map((e, i) => {
          const entrego = e.entregadaEn !== null;
          return (
            <motion.li
              key={e.alumnoId}
              className={cn(
                'relative flex flex-col items-center gap-[1vh] rounded-[1.75rem] bg-card p-[1.2vw] shadow-[var(--pd-sombra-tarjeta)] transition-opacity',
                !entrego && 'opacity-45',
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: entrego ? 1 : 0.45, scale: 1 }}
              transition={{ ...MOVIMIENTO.rebote, delay: i * 0.03 }}
            >
              <PinAvatar avatar={e.avatar} tamano={64} />
              <span className="w-full truncate text-center text-[clamp(1rem,1.4vw,1.7rem)] font-bold">{e.nombre}</span>
              {entrego && (
                <motion.span
                  className="absolute top-[1vh] right-[1vh] grid size-[clamp(1.6rem,2.2vw,2.6rem)] place-items-center rounded-full bg-pd-resp-d text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={MOVIMIENTO.rebote}
                >
                  <Check className="size-[60%]" strokeWidth={3} />
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

const arrancar = (vm: VmScratch) => {
  vm.start();
  vm.greenFlag();
};

/** Alto de la barra de la bandera verde del reproductor (no escala con el escenario). */
const BARRA_REPRODUCTOR = 48;

/** El tamaño más grande que entra: escenario 4:3 más la barra de arriba. */
function useTamanoReproductor() {
  const caja = useRef<HTMLDivElement>(null);
  const [tamano, setTamano] = useState<{ ancho: number; alto: number } | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const ancho = Math.floor(Math.min(el.clientWidth, ((el.clientHeight - BARRA_REPRODUCTOR) * 4) / 3));
      setTamano({ ancho, alto: Math.floor((ancho * 3) / 4) + BARRA_REPRODUCTOR });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { caja, tamano };
}

/** La entrega elegida por el profe, en el reproductor y arrancada con la bandera verde. */
function Reproductor({ estado }: { estado: EstadoDe<'scratch'> }) {
  const m = estado.vista.mostrando!;
  const { iframe, estado: reproductor } = useEditorScratch(m.url, arrancar);
  const { caja, tamano } = useTamanoReproductor();
  return (
    <>
      <div className="flex items-center justify-between gap-[2vw]">
        <div className="flex min-w-0 items-center gap-[1vw]">
          <PinAvatar avatar={m.avatar} tamano={72} />
          <h1 className="truncate text-[clamp(1.8rem,3.4vw,4rem)] font-extrabold">{m.nombre}</h1>
        </div>
        <p className="shrink-0 truncate text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">{estado.vista.titulo}</p>
      </div>
      <div ref={caja} className="relative min-h-0 flex-1">
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="overflow-hidden rounded-[1.75rem] bg-black shadow-[var(--pd-sombra-flotante)]"
            style={tamano ? { width: tamano.ancho, height: tamano.alto } : { width: '100%', height: '100%' }}
          >
            <iframe ref={iframe} src={URL_REPRODUCTOR} title={`Proyecto de ${m.nombre}`} className="size-full border-0" />
          </div>
        </div>
        {reproductor.fase !== 'listo' && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="flex items-center gap-3 rounded-full bg-card px-6 py-3 text-[clamp(1.1rem,1.6vw,2rem)] font-semibold shadow-[var(--pd-sombra-flotante)]">
              {reproductor.fase === 'cargando' ? <Spinner /> : <CircleAlert className="text-destructive" />}
              {reproductor.fase === 'cargando' ? 'Abriendo el proyecto…' : reproductor.mensaje}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

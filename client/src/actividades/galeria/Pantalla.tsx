import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CARITAS_ESCALA, type InfoServidor, type PuestoGaleria } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { MOVIMIENTO } from '@/lib/movimiento';
import { sonidos } from '@/lib/sonidos';
import { cn } from '@/lib/utils';
import { tirarConfetti } from '@/routes/pantalla/Podio';
import type { EstadoDe } from '../tipos';

/** Cuántos votó cada carita, con el promedio. La usan la pantalla, el alumno y el profe. */
export function BarrasCaritas({ resultados, promedio, compacto = false }: { resultados: number[]; promedio: number | null; compacto?: boolean }) {
  const maximo = Math.max(1, ...resultados);
  const total = resultados.reduce((a, b) => a + b, 0);
  return (
    <div className={cn('flex flex-col', compacto ? 'gap-3' : 'gap-[2vh]')}>
      <div className={cn('grid grid-cols-5 items-end', compacto ? 'h-28 gap-2' : 'h-[32vh] gap-[1.5vw]')}>
        {CARITAS_ESCALA.map((carita, i) => (
          <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
            <span className={cn('font-extrabold tabular-nums', compacto ? 'text-sm' : 'text-[clamp(1.2rem,2vw,2.6rem)]')}>{resultados[i]}</span>
            <motion.div
              className="w-full origin-bottom rounded-t-xl bg-pd-celeste"
              style={{ height: `${Math.max(4, (resultados[i]! / maximo) * 100)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...MOVIMIENTO.suave, delay: i * 0.06 }}
            />
            <span aria-hidden className={compacto ? 'text-2xl' : 'text-[clamp(2rem,4vw,5rem)] leading-none'}>
              {carita}
            </span>
          </div>
        ))}
      </div>
      <p className={cn('text-center font-bold', compacto ? 'text-base' : 'text-[clamp(1.4rem,2.4vw,3rem)]')}>
        {promedio === null ? 'Sin votos' : `Promedio: ${promedio.toLocaleString('es-AR')} de 5`}
        <span className="font-semibold text-muted-foreground">
          {' '}
          · {total} {total === 1 ? 'voto' : 'votos'}
        </span>
      </p>
    </div>
  );
}

export function PantallaGaleria({ estado }: { estado: EstadoDe<'galeria'>; recibido: number; info: InfoServidor | null }) {
  const v = estado.vista;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={v.fase === 'podio' ? 'podio' : `img-${v.imagen?.id}`}
        className="flex h-full min-h-0 flex-col"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, x: -60, transition: MOVIMIENTO.salida }}
      >
        {v.fase === 'podio' ? <Podio titulo={v.titulo} podio={v.podio} /> : <Dibujo estado={estado} />}
      </motion.div>
    </AnimatePresence>
  );
}

function Dibujo({ estado }: { estado: EstadoDe<'galeria'> }) {
  const v = estado.vista;
  const revelada = v.fase === 'revelada' && v.resultados;
  useEffect(() => {
    if (revelada) sonidos.redoble(0);
  }, [revelada]);
  if (!v.imagen) return null;
  const fraccion = v.pueden ? Math.min(1, v.votaron / v.pueden) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-[2vh]">
      <div className="flex items-baseline justify-between gap-[2vw]">
        <h1 className="truncate text-[clamp(1.6rem,3vw,3.6rem)] font-extrabold">{v.titulo}</h1>
        <p className="shrink-0 text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground tabular-nums">
          Dibujo {v.indice + 1} de {v.total}
        </p>
      </div>
      <div className={cn('grid min-h-0 flex-1 gap-[3vw]', revelada ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]')}>
        <motion.div layout className="relative flex min-h-0 items-center justify-center">
          <img src={v.imagen.url} alt={`Dibujo ${v.indice + 1}`} className="size-full object-contain drop-shadow-[0_18px_30px_rgb(16_42_67/0.22)]" />
          {v.imagen.autor && (
            <motion.span
              className="absolute bottom-[2vh] flex items-center gap-[0.8vw] rounded-full bg-card py-[0.6vh] pr-[1.6vw] pl-[0.5vw] text-[clamp(1.1rem,1.8vw,2.2rem)] font-bold shadow-[var(--pd-sombra-flotante)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOVIMIENTO.rebote}
            >
              <PinAvatar avatar={v.imagen.autor.avatar} tamano={48} />
              {v.imagen.autor.nombre}
            </motion.span>
          )}
        </motion.div>

        {revelada ? (
          <div className="flex flex-col justify-center rounded-[2.5rem] bg-card p-[2.5vw] shadow-[var(--pd-sombra-tarjeta)]">
            <BarrasCaritas resultados={v.resultados!} promedio={v.promedio} />
          </div>
        ) : (
          <div className="flex w-[clamp(10rem,18vw,22rem)] flex-col items-center justify-center gap-[2vh] text-center">
            <div className="relative grid size-[clamp(9rem,15vw,18rem)] place-items-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-muted" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="stroke-pd-celeste-oscuro"
                  pathLength={1}
                  strokeDasharray="1 1"
                  animate={{ strokeDashoffset: 1 - fraccion }}
                  transition={MOVIMIENTO.suave}
                />
              </svg>
              <span className="text-[clamp(2.2rem,4vw,5rem)] font-extrabold tabular-nums">
                {v.votaron}
                <span className="text-[0.5em] text-muted-foreground">/{v.pueden}</span>
              </span>
            </div>
            <p className="text-[clamp(1.2rem,2vw,2.4rem)] font-bold">votaron</p>
            <p className="text-[clamp(1.3rem,2.1vw,2.6rem)] leading-none whitespace-nowrap" aria-hidden>
              {CARITAS_ESCALA.join(' ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Momento (ms) en que aparece cada puesto: 3.º, 2.º y al final el 1.º. */
const TIEMPOS = [3000, 1700, 500];

function Podio({ titulo, podio }: { titulo: string; podio: PuestoGaleria[] }) {
  const [visibles, setVisibles] = useState<Set<number>>(new Set());
  useEffect(() => {
    const timers = podio.map((_, i) =>
      setTimeout(() => {
        setVisibles((s) => new Set(s).add(i));
        if (i === 0) {
          sonidos.fanfarria();
          tirarConfetti();
        } else sonidos.redoble(i === 2 ? 0 : 1);
      }, TIEMPOS[i]),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2.º a la izquierda, 1.º al centro, 3.º a la derecha.
  const orden = [1, 0, 2].filter((i) => i < podio.length);
  const altos = ['h-[20vh]', 'h-[14vh]', 'h-[9vh]'];

  return (
    <div className="flex h-full min-h-0 flex-col gap-[2vh]">
      <div className="flex flex-col gap-1">
        <h1 className="text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold">¡Los más votados!</h1>
        <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">{titulo}</p>
      </div>
      {podio.length === 0 ? (
        <p className="m-auto text-[clamp(1.4rem,2.4vw,3rem)] font-semibold text-muted-foreground">Nadie votó esta vez.</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-end justify-center gap-[2.5vw]">
          {orden.map((i) => {
            const p = podio[i]!;
            const visible = visibles.has(i);
            return (
              <div key={p.imagenId} className="flex w-[min(28vw,44vh)] flex-col items-center gap-[1.4vh]">
                <motion.div
                  className="flex w-full flex-col items-center gap-[1vh]"
                  initial={false}
                  animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.8 }}
                  transition={MOVIMIENTO.rebote}
                >
                  <img
                    src={p.url}
                    alt={`Puesto ${p.puesto}`}
                    className={cn(
                      'aspect-square w-full rounded-[1.6rem] bg-card object-cover shadow-[var(--pd-sombra-flotante)]',
                      i === 0 && 'ring-[0.6vh] ring-[#F5B700]',
                    )}
                  />
                  {p.autor && (
                    <span className="flex max-w-full items-center gap-[0.6vw] text-[clamp(1rem,1.7vw,2.1rem)] font-bold">
                      <PinAvatar avatar={p.autor.avatar} tamano={40} />
                      <span className="truncate">{p.autor.nombre}</span>
                    </span>
                  )}
                  <span className="text-[clamp(0.95rem,1.4vw,1.8rem)] font-semibold text-muted-foreground tabular-nums">
                    {p.promedio.toLocaleString('es-AR')} de 5 · {p.votos} {p.votos === 1 ? 'voto' : 'votos'}
                  </span>
                </motion.div>
                <div
                  className={cn(
                    'flex w-full items-start justify-center rounded-t-[1.4rem] pt-[1vh] text-[clamp(2rem,4vw,5rem)]',
                    altos[i],
                    i === 0 ? 'bg-pd-celeste-oscuro' : 'bg-pd-celeste',
                  )}
                >
                  {['🥇', '🥈', '🥉'][i]}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

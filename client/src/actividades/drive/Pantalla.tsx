import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { InfoServidor } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { MOVIMIENTO } from '@/lib/movimiento';
import { nombresCortos } from '@/lib/nombres';
import { sonidos } from '@/lib/sonidos';
import { cn } from '@/lib/utils';
import type { EstadoDe } from '../tipos';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export function PantallaMisiones({ estado, info }: { estado: EstadoDe<'drive'>; recibido: number; info: InfoServidor | null }) {
  const v = estado.vista;
  const direccion = info?.url.replace(/^https?:\/\//, '') ?? '';
  const cortos = nombresCortos(v.alumnos.map((a) => ({ id: a.alumnoId, nombre: a.nombre })));
  const completaron = useRef(v.completaron);
  useEffect(() => {
    if (v.completaron > completaron.current) sonidos.pop();
    completaron.current = v.completaron;
  }, [v.completaron]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-[3vw]">
      <div className="flex min-h-0 flex-col gap-[2.5vh]">
        <div className="flex flex-col gap-[1vh]">
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">Misiones en Drive, comisión {estado.comisionNombre}</p>
          <h1 className="text-[clamp(2rem,4vw,5rem)] leading-[1.05] font-extrabold">{v.titulo}</h1>
          {direccion && (
            <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold">
              Entrá a <span className="font-extrabold text-acento">{direccion}</span>
            </p>
          )}
        </div>
        <ol className="flex flex-col gap-[1.6vh]">
          {v.pasos.map((p, i) => {
            const n = v.alumnos.filter((a) => a.hechos[i]).length;
            const fraccion = v.participantes ? n / v.participantes : 0;
            return (
              <li key={i} className="flex flex-col gap-[0.6vh] rounded-[1.4rem] bg-card px-[1.4vw] py-[1.4vh] shadow-[var(--pd-sombra-tarjeta)]">
                <div className="flex items-center gap-[1vw]">
                  <span className="grid size-[clamp(2rem,2.6vw,3.2rem)] shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-[clamp(1rem,1.4vw,1.8rem)] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[clamp(1rem,1.5vw,1.9rem)] leading-tight font-semibold">{p}</span>
                  <span className="text-[clamp(1rem,1.5vw,1.9rem)] font-extrabold tabular-nums">
                    {n}/{v.participantes}
                  </span>
                </div>
                <div className="h-[0.8vh] overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-[#188038]" animate={{ width: `${fraccion * 100}%` }} transition={MOVIMIENTO.suave} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex min-h-0 flex-col gap-[2vh] rounded-[2.5rem] bg-pd-celeste-claro/70 px-[2.5vw] py-[3vh] dark:bg-pd-celeste-oscuro/20">
        <h2 className="text-[clamp(1.3rem,2.2vw,2.6rem)] font-bold">
          {v.fase === 'fin'
            ? '¡Tiempo!'
            : v.completaron === 0
              ? v.participantes === 0
                ? 'Esperando que entren…'
                : '¿Quién completa todo primero?'
              : `${v.completaron} de ${v.participantes} completaron todo`}
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(clamp(6rem,9vw,11rem),1fr))] content-start gap-[2vh] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {v.alumnos.map((a) => {
              const listo = a.puesto !== null;
              return (
                <motion.li
                  key={a.alumnoId}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: a.conectado ? 1 : 0.45, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={MOVIMIENTO.rebote}
                  className="relative flex flex-col items-center gap-[0.8vh] text-center"
                >
                  <span className="relative">
                    <PinAvatar avatar={a.avatar} tamano={68} />
                    {listo && (
                      <motion.span
                        className="absolute -top-2 -right-3 text-[clamp(1.5rem,2.2vw,2.8rem)]"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={MOVIMIENTO.rebote}
                      >
                        {a.puesto! <= 3 ? MEDALLAS[a.puesto! - 1] : '✅'}
                      </motion.span>
                    )}
                  </span>
                  <span className="w-full truncate text-[clamp(0.9rem,1.2vw,1.5rem)] font-semibold">{cortos.get(a.alumnoId)}</span>
                  <span className="flex gap-[0.3vw]" aria-label={`${a.hechos.filter(Boolean).length} de ${a.hechos.length}`}>
                    {a.hechos.map((h, i) => (
                      <span
                        key={i}
                        className={cn(
                          'grid size-[clamp(0.9rem,1.1vw,1.4rem)] place-items-center rounded-full transition-colors',
                          h ? 'bg-[#188038] text-white' : 'bg-foreground/15',
                        )}
                      >
                        {h && <Check className="size-[70%]" strokeWidth={4} />}
                      </span>
                    ))}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

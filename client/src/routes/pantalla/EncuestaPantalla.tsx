import { AnimatePresence, motion } from 'motion/react';
import { MessageCircleQuestion } from 'lucide-react';
import type { EncuestaEnVivo } from '@aula/shared';
import { cn } from '@/lib/utils';

/** Encuesta en la pantalla grande: mientras está abierta, solo cuántos respondieron; al cerrar, los resultados. */
export function EncuestaPantalla({ encuesta: e }: { encuesta: EncuestaEnVivo }) {
  const total = e.resultados?.reduce((a, b) => a + b, 0) ?? 0;
  const max = Math.max(1, ...(e.resultados ?? [0]));
  return (
    <div className="flex h-full min-h-0 flex-col gap-[4vh]">
      <div className="flex items-start justify-between gap-[3vw]">
        <div className="flex flex-col gap-[1.2vh]">
          <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
            {e.tipo === 'texto' ? 'Ticket de salida' : 'Encuesta'}
            {e.anonima && ' · anónima'}
          </p>
          <h1 className="text-[clamp(2rem,4.4vw,5.4rem)] leading-[1.05] font-extrabold text-balance">{e.pregunta}</h1>
        </div>
        <div className="flex flex-col items-center rounded-[2rem] bg-card px-[2vw] py-[2vh] shadow-[var(--pd-sombra-flotante)]">
          <motion.span
            key={e.respondieron}
            className="text-[clamp(2.6rem,5vw,6rem)] leading-none font-extrabold text-pd-celeste-oscuro tabular-nums"
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {e.respondieron}
          </motion.span>
          <span className="text-[clamp(0.9rem,1.3vw,1.6rem)] font-semibold text-muted-foreground">
            de {e.conectados} {e.abierta ? 'respondieron' : 'respondieron (cerrada)'}
          </span>
        </div>
      </div>

      {e.tipo === 'texto' ? (
        <div className="grid flex-1 place-items-center">
          <p className="text-center text-[clamp(1.4rem,2.6vw,3.2rem)] font-semibold text-muted-foreground">
            {e.abierta ? 'Escribí tu respuesta en tu compu.' : '¡Gracias! El profe va a leer todas las respuestas.'}
          </p>
        </div>
      ) : e.tipo === 'escala' ? (
        <div className="grid flex-1 grid-cols-5 items-end gap-[2vw] px-[4vw]">
          {e.opciones.map((c, i) => {
            const votos = e.resultados?.[i] ?? 0;
            return (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-[1.5vh]">
                {e.resultados && <span className="text-[clamp(1.6rem,3vw,3.6rem)] font-extrabold tabular-nums">{votos}</span>}
                {e.resultados && (
                  <motion.div
                    className="w-full rounded-t-3xl bg-pd-celeste"
                    initial={{ height: 0 }}
                    animate={{ height: `${(votos / max) * 38}vh` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.08 }}
                  />
                )}
                <span className="text-[clamp(3rem,7vw,8rem)] leading-none">{c}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-[1.8vh]">
          {e.opciones.map((o, i) => {
            const votos = e.resultados?.[i] ?? 0;
            const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
            return (
              <li key={i} className="relative overflow-hidden rounded-full bg-card shadow-[var(--pd-sombra-tarjeta)]">
                {e.resultados && (
                  <motion.span
                    className={cn('absolute inset-y-0 left-0', votos === max ? 'bg-pd-celeste/45' : 'bg-pd-celeste-claro')}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20, delay: i * 0.1 }}
                  />
                )}
                <span className="relative flex items-center gap-[1.4vw] px-[2.4vw] py-[2vh] text-[clamp(1.4rem,2.8vw,3.4rem)] font-bold">
                  <span className="min-w-0 flex-1">{o}</span>
                  {e.resultados && <span className="tabular-nums">{pct}%</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Pregunta anónima que el profe eligió mostrar: se superpone a lo que haya en la pantalla. */
export function PreguntaDestacada({ texto }: { texto: string | null }) {
  return (
    <AnimatePresence>
      {texto && (
        <motion.div
          key={texto}
          className="absolute inset-0 z-20 grid place-items-center bg-foreground/25 p-[5vw] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.figure
            className="flex max-w-[80vw] flex-col gap-[3vh] rounded-[3rem] bg-card px-[5vw] py-[6vh] shadow-[var(--pd-sombra-flotante)]"
            initial={{ scale: 0.85, y: 40, rotate: -1.5 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <figcaption className="flex items-center gap-3 text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">
              <MessageCircleQuestion className="size-[1.4em] text-pd-celeste-oscuro" />
              Pregunta anónima
            </figcaption>
            <blockquote className="text-[clamp(2rem,4.6vw,5.6rem)] leading-[1.1] font-extrabold text-balance">“{texto}”</blockquote>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

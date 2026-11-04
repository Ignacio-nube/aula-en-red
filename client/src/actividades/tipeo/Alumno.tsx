import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AlumnoPublico } from '@aula/shared';
import { PinAvatar, PinLoader } from '@/components/pd/Pin';
import { Dato, Tipeador } from '@/components/pd/Tipeador';
import { useCuentaAtras } from '@/lib/actividad';
import { emitirConAck, ordinal } from '@/lib/juego';
import { esLiviano } from '@/lib/liviano';
import { escalon, MOVIMIENTO } from '@/lib/movimiento';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { EstadoDe } from '../tipos';

interface Props {
  estado: EstadoDe<'tipeo'>;
  recibido: number;
  socket: SocketAula | null;
  alumno: AlumnoPublico;
}

export function AlumnoTipeo({ estado, recibido, socket, alumno }: Props) {
  const v = estado.vista;
  const clave = `${v.fase}-${v.carreraId ?? ''}-${v.textoId}`;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={clave}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, transition: MOVIMIENTO.salida }}
      >
        {v.fase === 'sala' && <Sala estado={estado} alumno={alumno} />}
        {v.fase === 'cuenta' && <Cuenta restanteMs={v.restanteMs ?? 0} recibido={recibido} />}
        {v.fase === 'carrera' && <Carrera estado={estado} recibido={recibido} socket={socket} />}
        {v.fase === 'fin' && <Fin estado={estado} alumno={alumno} />}
      </motion.div>
    </AnimatePresence>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 text-center sm:px-6 sm:pb-10">
      <div className="m-auto flex w-full max-w-3xl flex-col items-center gap-4 bajo:gap-2">{children}</div>
    </div>
  );
}

function Sala({ estado, alumno }: { estado: EstadoDe<'tipeo'>; alumno: AlumnoPublico }) {
  const v = estado.vista;
  return (
    <Centro>
      <PinAvatar avatar={alumno.avatar} tamano={72} className="bajo:hidden" />
      <h1 className="text-4xl font-extrabold sm:text-5xl bajo:text-3xl">Carrera de tipeo</h1>
      <p className="text-lg text-balance text-muted-foreground sm:text-xl">
        Cuando arranque, tipeá el texto lo más rápido que puedas. Si te equivocás, la letra se pone roja hasta que pongas la correcta.
      </p>
      {/* El texto se adivina, pero recién se puede leer cuando arranca. */}
      <p
        className="w-full rounded-3xl bg-card p-5 text-left font-mono text-lg leading-relaxed text-muted-foreground shadow-[var(--pd-sombra-tarjeta)] blur-[5px] select-none"
        aria-hidden
      >
        {v.texto}
      </p>
      <p className="flex items-center gap-2 font-semibold text-muted-foreground">
        <PinLoader tamano={28} />
        Esperando que el profe arranque…
      </p>
    </Centro>
  );
}

function Cuenta({ restanteMs, recibido }: { restanteMs: number; recibido: number }) {
  const restante = useCuentaAtras(restanteMs, recibido, 100) ?? 0;
  const n = Math.max(1, Math.ceil(restante / 1000));
  return (
    <Centro>
      <p className="text-xl font-semibold text-muted-foreground sm:text-2xl">Poné los dedos en el teclado</p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          className="text-[8rem] leading-none font-extrabold text-pd-celeste-oscuro sm:text-[10rem] bajo:text-[5rem]"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0, transition: MOVIMIENTO.salida }}
          transition={MOVIMIENTO.rebote}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </Centro>
  );
}

function Carrera({ estado, recibido, socket }: { estado: EstadoDe<'tipeo'>; recibido: number; socket: SocketAula | null }) {
  const v = estado.vista;
  const yo = v.yo;
  const restante = useCuentaAtras(v.restanteMs, recibido, 250);
  return (
    <Tipeador
      texto={v.texto}
      servidor={yo}
      transcurridoMs={v.transcurridoMs}
      recibido={recibido}
      restanteMs={restante}
      enviar={(p) => void emitirConAck(socket, 'actividad:enviar', p)}
      terminado={({ ppm, precision }) => (
        <Centro>
          <motion.span className="text-7xl" aria-hidden initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={MOVIMIENTO.rebote}>
            🏁
          </motion.span>
          <h1 className="text-4xl font-extrabold sm:text-5xl">¡Llegaste!</h1>
          <p className="text-2xl font-bold text-pd-celeste-oscuro">
            {yo?.ppm || ppm} palabras por minuto, {yo?.precision ?? precision}% de precisión
          </p>
          {yo?.puesto && <p className="text-xl font-semibold">Vas {ordinal(yo.puesto)}</p>}
          <p className="text-lg text-muted-foreground">Esperando a los demás…</p>
        </Centro>
      )}
    />
  );
}

function Fin({ estado, alumno }: { estado: EstadoDe<'tipeo'>; alumno: AlumnoPublico }) {
  const v = estado.vista;
  const yo = v.yo;
  const record = yo !== undefined && yo.ppm > 0 && yo.mejorAnterior !== null && yo.ppm > yo.mejorAnterior;
  const primera = yo !== undefined && yo.mejorAnterior === null && yo.ppm > 0;

  useEffect(() => {
    if ((!record && yo?.puesto !== 1) || esLiviano()) return;
    void confetti({ particleCount: 80, spread: 80, startVelocity: 40, origin: { y: 0.7 }, disableForReducedMotion: true, ticks: 180 });
  }, [record, yo?.puesto]);

  if (!yo || yo.posicion === 0) {
    return (
      <Centro>
        <h1 className="text-4xl font-extrabold">Terminó la carrera</h1>
        <p className="text-lg text-muted-foreground">Esta vez no llegaste a tipear. ¡En la próxima!</p>
      </Centro>
    );
  }
  return (
    <Centro>
      <motion.span
        className="text-7xl"
        aria-hidden
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...MOVIMIENTO.rebote, delay: 0.1 }}
      >
        {yo.puesto === 1 ? '🏆' : yo.puesto === 2 ? '🥈' : yo.puesto === 3 ? '🥉' : record ? '🚀' : '⌨️'}
      </motion.span>
      <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">{yo.puesto ? `Quedaste ${ordinal(yo.puesto)}` : 'Terminó la carrera'}</h1>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
        <Dato valor={yo.ppm} etiqueta="palabras por minuto" />
        <Dato valor={`${yo.precision}%`} etiqueta="precisión" />
      </div>
      {record && (
        <motion.p
          className="flex items-center gap-2 rounded-full bg-pd-celeste-claro px-5 py-2 text-lg font-bold text-pd-celeste-oscuro"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...MOVIMIENTO.rebote, delay: 0.4 }}
        >
          <Trophy className="size-5" />
          ¡Nueva mejor marca! Antes: {yo.mejorAnterior} ppm
        </motion.p>
      )}
      {primera && <p className="text-lg text-muted-foreground">Es tu primera marca: la próxima vez vas a ver si la superás.</p>}
      {!record && !primera && yo.mejorAnterior !== null && <p className="text-lg text-muted-foreground">Tu mejor marca sigue siendo {yo.mejorAnterior} ppm.</p>}
      {v.corredores.length > 0 && (
        <ol className="mt-2 flex w-full max-w-md flex-col gap-2">
          {v.corredores.map((c, i) => (
            <motion.li
              key={c.alumnoId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...MOVIMIENTO.suave, delay: escalon(i, 0.08, 0.3) }}
              className={cn(
                'flex items-center gap-3 rounded-full py-1.5 pr-5 pl-2 text-base sm:text-lg',
                c.alumnoId === alumno.id ? 'bg-pd-celeste-claro font-bold' : 'bg-card',
              )}
            >
              <span className="w-8 text-right font-bold text-muted-foreground">{ordinal(c.puesto)}</span>
              <PinAvatar avatar={c.avatar} tamano={30} />
              <span className="min-w-0 flex-1 truncate text-left">{c.nombre}</span>
              <span className="font-semibold tabular-nums">{c.ppm} ppm</span>
            </motion.li>
          ))}
        </ol>
      )}
    </Centro>
  );
}

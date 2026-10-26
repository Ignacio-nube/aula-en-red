import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import type { AlumnoPublico, EstadoJuego, RespuestaJuego } from '@aula/shared';
import { Numero } from '@/components/pd/Numero';
import { PinAvatar, PinLoader } from '@/components/pd/Pin';
import { PreguntaAlumno } from '@/components/pd/PreguntaAlumno';
import { BotonRespuesta, nombreRespuesta } from '@/components/pd/Respuesta';
import { Temporizador } from '@/components/pd/Temporizador';
import confetti from 'canvas-confetti';
import { emitirConAck, formatoPuntos, ordinal, useRestante } from '@/lib/juego';
import { esLiviano } from '@/lib/liviano';
import type { SocketAula } from '@/lib/socket';

// La salida es corta a propósito: con mode="wait" la pantalla nueva espera a que termine, y la
// pregunta tiene que aparecer al instante.
const entrada = {
  initial: { opacity: 0, scale: 0.94, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: 'easeIn' } },
} as const;

interface Props {
  estado: EstadoJuego;
  recibido: number;
  socket: SocketAula | null;
  alumno: AlumnoPublico;
}

/** La pantalla del alumno sigue lo que pasa en el quiz: cuenta, pregunta, resultado, ranking y podio. */
export function JuegoAlumno({ estado, recibido, socket, alumno }: Props) {
  // La clave cambia con la fase y la pregunta: cada pantalla entra con su animación.
  const clave = `${estado.fase}-${estado.indice}-${estado.fase === 'pregunta' && estado.yo?.respondio ? 'r' : ''}`;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={clave} className="flex min-h-0 flex-1 flex-col" {...entrada}>
        <Fase estado={estado} recibido={recibido} socket={socket} alumno={alumno} />
      </motion.div>
    </AnimatePresence>
  );
}

function Fase({ estado, recibido, socket, alumno }: Props) {
  switch (estado.fase) {
    case 'lobby':
      return (
        <Centro>
          <PinAvatar avatar={alumno.avatar} tamano={88} className="bajo:hidden" />
          <h1 className="text-4xl font-extrabold sm:text-5xl bajo:text-3xl">¡Ya estás adentro!</h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Vas a jugar <span className="font-semibold text-foreground">{estado.quizTitulo}</span>. Arranca cuando el profe diga.
          </p>
          <PinLoader tamano={44} className="mt-2 bajo:hidden" />
        </Centro>
      );
    case 'cuenta':
      return <Cuenta estado={estado} recibido={recibido} />;
    case 'pregunta':
      return <Pregunta estado={estado} recibido={recibido} socket={socket} />;
    case 'resultado':
      return <Resultado estado={estado} />;
    case 'ranking':
      return <Posicion estado={estado} />;
    case 'podio':
      return <Final estado={estado} alumno={alumno} />;
  }
}

function Centro({ children, className }: { children: React.ReactNode; className?: string }) {
  // Centrado, pero si no entra (celu acostado) se puede scrollear sin que se corte arriba.
  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 text-center sm:px-6 sm:pb-10 ${className ?? ''}`}>
      <div className="m-auto flex w-full flex-col items-center gap-4 bajo:gap-2">{children}</div>
    </div>
  );
}

function Cuenta({ estado, recibido }: { estado: EstadoJuego; recibido: number }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    const tick = () => setN(Math.max(1, Math.ceil((3000 - (performance.now() - recibido)) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [recibido]);
  return (
    <Centro>
      <p className="text-xl font-semibold text-muted-foreground sm:text-2xl">
        Pregunta {estado.indice + 1} de {estado.total}
      </p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          className="text-[8rem] leading-none font-extrabold text-pd-celeste-oscuro sm:text-[10rem] bajo:text-[5rem]"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          {n}
        </motion.span>
      </AnimatePresence>
      <p className="text-xl text-muted-foreground">¡Preparate!</p>
    </Centro>
  );
}

function Pregunta({ estado, recibido, socket }: { estado: EstadoJuego; recibido: number; socket: SocketAula | null }) {
  const restante = useRestante({ estado, recibido });
  const [enviando, setEnviando] = useState<RespuestaJuego | null>(null);
  const p = estado.pregunta;
  if (!p) return null;

  const elegida = estado.yo?.opcionId ?? (typeof enviando === 'number' ? enviando : null);

  if (estado.yo?.respondio) {
    const i = p.opciones.findIndex((o) => o.id === estado.yo!.opcionId);
    return (
      <Centro>
        <Temporizador restanteMs={restante} totalMs={estado.tiempoTotalMs} pausado={estado.pausado} tamano={72} />
        <h1 className="text-3xl font-extrabold sm:text-4xl bajo:text-2xl">¡Listo! Esperando a los demás…</h1>
        <p className="text-lg text-muted-foreground">
          {estado.respondieron} de {estado.conectados} ya respondieron
        </p>
        {i >= 0 && (
          <div className="mt-2 w-full max-w-md">
            <BotonRespuesta tipo={p.tipo} indice={i} texto={p.opciones[i]!.texto} disabled tamano="md" className="w-full" />
          </div>
        )}
        {p.tipo === 'varias' && estado.yo.opcionIds && (
          <div className="mt-2 flex w-full max-w-md flex-col gap-2">
            {p.opciones.map((o, k) =>
              estado.yo!.opcionIds!.includes(o.id) ? (
                <BotonRespuesta key={o.id} tipo={p.tipo} indice={k} texto={o.texto} disabled tamano="md" className="w-full" />
              ) : null,
            )}
          </div>
        )}
        {p.tipo === 'ordenar' && estado.yo.opcionIds && <ListaPasos ids={estado.yo.opcionIds} pregunta={p} />}
      </Centro>
    );
  }

  const responder = async (respuesta: RespuestaJuego) => {
    if (enviando !== null) return;
    setEnviando(respuesta);
    const r = await emitirConAck(socket, 'juego:responder', respuesta);
    if (!r.ok) {
      toast.error(r.error);
      setEnviando(null);
    }
  };

  return (
    <PreguntaAlumno
      pregunta={p}
      indice={estado.indice}
      total={estado.total}
      restanteMs={restante}
      totalMs={estado.tiempoTotalMs}
      pausado={estado.pausado}
      elegida={elegida}
      bloqueado={enviando !== null || restante <= 0}
      onResponder={responder}
    />
  );
}

function Resultado({ estado }: { estado: EstadoJuego }) {
  const p = estado.pregunta;
  const yo = estado.yo;
  if (!p || !yo) return null;
  const iCorrecta = p.opciones.findIndex((o) => o.correcta);
  const correcta = p.opciones[iCorrecta];
  const nombreCorrecta =
    p.tipo === 'varias' ? 'otra combinación' : p.tipo === 'ordenar' ? 'otro orden' : correcta ? nombreRespuesta(p.tipo, iCorrecta, correcta.texto) : '';

  const bien = yo.correcta === true;
  return <TarjetaResultado estado={estado} bien={bien} nombreCorrecta={nombreCorrecta} />;
}

function TarjetaResultado({ estado, bien, nombreCorrecta }: { estado: EstadoJuego; bien: boolean; nombreCorrecta: string }) {
  const p = estado.pregunta!;
  const yo = estado.yo!;
  const correcta = p.tipo === 'multiple' || p.tipo === 'vf' ? p.opciones.find((o) => o.correcta) : undefined;

  // Un festejo chiquito en la propia compu (sin sonido: los sonidos son solo de la pantalla grande).
  useEffect(() => {
    if (!bien || esLiviano()) return;
    void confetti({
      particleCount: 70,
      spread: 75,
      startVelocity: 38,
      origin: { y: 0.75 },
      colors: ['#3AB6E6', '#0B7DB0', '#F5B700', '#2BB673', '#FFFFFF'],
      disableForReducedMotion: true,
      ticks: 160,
    });
  }, [bien]);

  const fondo = bien ? 'var(--pd-bien-fondo)' : yo.respondio ? 'var(--pd-mal-fondo)' : 'var(--pd-neutro-fondo)';
  const titulo = bien ? '¡Correcto!' : yo.respondio ? `¡Uy! Era ${nombreCorrecta}` : 'Se acabó el tiempo';

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 sm:pb-10">
      <motion.div
        className="m-auto flex w-full max-w-2xl flex-col items-center gap-3 rounded-[2.5rem] px-6 py-10 text-center text-white shadow-[var(--pd-sombra-flotante)] sm:px-8 sm:py-12 bajo:gap-1 bajo:py-5"
        style={{ backgroundColor: fondo, textShadow: '0 1px 3px rgb(0 0 0 / 0.25)' }}
        initial={{ scale: 0.6, rotate: bien ? -4 : 4 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 14 }}
      >
        <motion.span
          className="text-6xl sm:text-7xl bajo:text-4xl"
          aria-hidden
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.12 }}
        >
          {bien ? '🎉' : yo.respondio ? '😅' : '⏰'}
        </motion.span>
        <h1 className="text-4xl font-extrabold text-balance sm:text-5xl bajo:text-3xl">{titulo}</h1>
        {bien && p.multiplicador > 0 && (
          <p className="text-5xl font-extrabold tabular-nums sm:text-6xl bajo:text-4xl">
            +<Numero valor={yo.puntosPregunta ?? 0} desde={0} />
          </p>
        )}
        {bien && p.multiplicador === 0 && <p className="text-2xl font-semibold">Esta no sumaba puntos, pero la sabías.</p>}
        {!bien && correcta && (
          <p className="text-xl font-semibold text-balance sm:text-2xl">{p.tipo === 'vf' ? `La respuesta era ${correcta.texto}.` : `${correcta.texto}`}</p>
        )}
        {bien && yo.racha >= 2 && (
          <p className="mt-2 rounded-full bg-white/20 px-5 py-2 text-lg font-bold sm:text-xl">
            🔥 Racha de {yo.racha}
            {yo.bonus ? ` (+${formatoPuntos(yo.bonus)} de bonus)` : ''}
          </p>
        )}
        {!bien && p.tipo === 'varias' && (
          <p className="text-xl font-semibold text-balance sm:text-2xl">
            Eran: {p.opciones.filter((o) => o.correcta).map((o) => o.texto).join(', ')}.
          </p>
        )}
        {!bien && p.tipo === 'ordenar' && p.ordenCorrecto && <ListaPasos ids={p.ordenCorrecto} pregunta={p} claro />}
        {!bien && <p className="text-lg font-medium">En la próxima la sacás.</p>}
      </motion.div>
    </div>
  );
}

/** Pasos numerados (el orden que mandó el alumno, o el correcto). */
function ListaPasos({ ids, pregunta, claro }: { ids: number[]; pregunta: NonNullable<EstadoJuego['pregunta']>; claro?: boolean }) {
  return (
    <ol className="mt-1 flex w-full max-w-md flex-col gap-1.5 text-left">
      {ids.map((id, i) => (
        <li
          key={id}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-base font-semibold ${claro ? 'bg-white/20' : 'bg-card shadow-[var(--pd-sombra-tarjeta)]'}`}
        >
          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm ${claro ? 'bg-white/30' : 'bg-pd-celeste-oscuro text-white'}`}>{i + 1}</span>
          {pregunta.opciones.find((o) => o.id === id)?.texto}
        </li>
      ))}
    </ol>
  );
}

function Posicion({ estado }: { estado: EstadoJuego }) {
  const yo = estado.yo;
  if (!yo) return null;
  const ultima = estado.indice + 1 >= estado.total;
  return (
    <Centro>
      <p className="text-xl font-semibold text-muted-foreground sm:text-2xl">{ultima ? 'Antes del podio…' : `Después de la pregunta ${estado.indice + 1}`}</p>
      <h1 className="text-5xl font-extrabold sm:text-6xl bajo:text-4xl">
        {yo.puesto ? `Vas ${ordinal(yo.puesto)}` : 'Seguí jugando'}
      </h1>
      <p className="text-2xl font-bold text-pd-celeste-oscuro sm:text-3xl">
        <Numero valor={yo.puntos} desde={Math.max(0, yo.puntos - (yo.puntosPregunta ?? 0))} /> puntos
      </p>
      {yo.racha >= 2 && <p className="text-xl font-semibold">🔥 {yo.racha} correctas seguidas</p>}
    </Centro>
  );
}

function Final({ estado, alumno }: { estado: EstadoJuego; alumno: AlumnoPublico }) {
  const yo = estado.yo;
  const puesto = yo?.puesto ?? null;
  const medalla = puesto === 1 ? '🏆' : puesto === 2 ? '🥈' : puesto === 3 ? '🥉' : '👏';
  return (
    <Centro>
      <motion.span
        className="text-7xl sm:text-8xl bajo:text-5xl"
        aria-hidden
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}
      >
        {medalla}
      </motion.span>
      <h1 className="text-4xl font-extrabold text-balance sm:text-5xl bajo:text-3xl">{puesto && puesto <= 3 ? `¡Quedaste ${ordinal(puesto)}!` : '¡Terminó el quiz!'}</h1>
      <p className="text-xl text-muted-foreground sm:text-2xl">
        {puesto ? `Terminaste ${ordinal(puesto)} con ` : 'Sumaste '}
        <span className="font-bold text-foreground">{formatoPuntos(yo?.puntos ?? 0)} puntos</span>.
      </p>
      {estado.ranking.length > 0 && (
        <ol className="mt-4 flex w-full max-w-md flex-col gap-2 bajo:mt-1">
          {estado.ranking.map((r, i) => (
            <motion.li
              key={r.alumnoId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.35 + i * 0.08 }}
              className={`flex items-center gap-3 rounded-full py-1.5 pr-5 pl-2 text-base sm:text-lg ${r.alumnoId === alumno.id ? 'bg-pd-celeste-claro font-bold' : 'bg-card'}`}
            >
              <span className="w-8 text-right font-bold text-muted-foreground">{ordinal(r.puesto)}</span>
              <PinAvatar avatar={r.avatar} tamano={30} />
              <span className="min-w-0 flex-1 truncate text-left">{r.nombre}</span>
              <span className="font-semibold tabular-nums">{formatoPuntos(r.puntos)}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </Centro>
  );
}

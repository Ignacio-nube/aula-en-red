import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CorredorTipeo, InfoServidor } from '@aula/shared';
import { Logo } from '@/components/pd/Logo';
import { PinAvatar } from '@/components/pd/Pin';
import { formatoReloj, useCuentaAtras } from '@/lib/actividad';
import { ordinal } from '@/lib/juego';
import { escalon, MOVIMIENTO } from '@/lib/movimiento';
import { nombresCortos } from '@/lib/nombres';
import { sonidos } from '@/lib/sonidos';
import { cn } from '@/lib/utils';
import { tirarConfetti } from '@/routes/pantalla/Podio';
import type { EstadoDe } from '../tipos';

interface Props {
  estado: EstadoDe<'tipeo'>;
  recibido: number;
  info: InfoServidor | null;
}

export function PantallaTipeo({ estado, recibido, info }: Props) {
  const v = estado.vista;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${v.fase}-${v.textoId}`}
        className="flex h-full min-h-0 flex-col"
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, y: -12, transition: MOVIMIENTO.salida }}
      >
        {v.fase === 'sala' && <Sala estado={estado} info={info} />}
        {v.fase === 'cuenta' && <Cuenta restanteMs={v.restanteMs ?? 0} recibido={recibido} titulo={v.titulo} />}
        {v.fase === 'carrera' && <Pista estado={estado} recibido={recibido} />}
        {v.fase === 'fin' && <Podio estado={estado} />}
      </motion.div>
    </AnimatePresence>
  );
}

function Sala({ estado, info }: { estado: EstadoDe<'tipeo'>; info: InfoServidor | null }) {
  const v = estado.vista;
  const cantidad = useRef(v.corredores.length);
  useEffect(() => {
    if (v.corredores.length > cantidad.current) sonidos.pop();
    cantidad.current = v.corredores.length;
  }, [v.corredores.length]);
  const direccion = info?.url.replace(/^https?:\/\//, '') ?? '';
  const cortos = nombresCortos(v.corredores.map((c) => ({ id: c.alumnoId, nombre: c.nombre })));
  return (
    <div className="flex h-full flex-col gap-[3vh]">
      <div className="grid grid-cols-[1fr_auto] items-center gap-[3vw]">
        <div className="flex min-w-0 flex-col gap-[1.2vh]">
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">Carrera de tipeo, comisión {estado.comisionNombre}</p>
          <h1 className="text-[clamp(2.2rem,4.6vw,5.5rem)] leading-[1.05] font-extrabold">{v.titulo}</h1>
          <p className="text-[clamp(1.2rem,2.2vw,2.8rem)] font-semibold">
            Entrá a <span className="font-extrabold text-acento tabular-nums">{direccion}</span>
            {v.facil && <span className="ml-[1vw] rounded-full bg-pd-celeste-claro px-[1vw] py-[0.3vh] text-[0.7em]">Modo fácil</span>}
          </p>
        </div>
        {info && (
          <div className="rounded-[1.6rem] bg-card p-[1vw] shadow-[var(--pd-sombra-flotante)]">
            <img src={info.qr} alt={`Código QR para entrar a ${info.url}`} className="size-[min(15vw,24vh)] [image-rendering:pixelated]" />
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[2vh] rounded-[2.5rem] bg-pd-celeste-claro/70 px-[3vw] py-[3vh]">
        <h2 className="text-[clamp(1.3rem,2.2vw,2.6rem)] font-bold">
          {v.corredores.length === 0 ? 'Esperando corredores…' : v.corredores.length === 1 ? '1 en la largada' : `${v.corredores.length} en la largada`}
        </h2>
        <ul className="flex flex-wrap content-start gap-x-[2vw] gap-y-[2vh] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {[...v.corredores]
              .sort((a, b) => a.alumnoId - b.alumnoId)
              .map((c) => (
                <motion.li
                  key={c.alumnoId}
                  layout
                  initial={{ opacity: 0, y: 40, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, transition: MOVIMIENTO.salida }}
                  transition={MOVIMIENTO.rebote}
                  className="flex w-[clamp(5.5rem,8vw,10rem)] flex-col items-center gap-2 text-center"
                >
                  <PinAvatar avatar={c.avatar} tamano={72} />
                  <span className="w-full truncate text-[clamp(0.95rem,1.3vw,1.6rem)] font-semibold">{cortos.get(c.alumnoId)}</span>
                </motion.li>
              ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

function Cuenta({ restanteMs, recibido, titulo }: { restanteMs: number; recibido: number; titulo: string }) {
  const restante = useCuentaAtras(restanteMs, recibido, 100) ?? 0;
  const n = Math.max(1, Math.ceil(restante / 1000));
  const previo = useRef(0);
  useEffect(() => {
    if (n !== previo.current) sonidos.cuenta(n === 1);
    previo.current = n;
  }, [n]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[3vh]">
      <p className="text-[clamp(1.6rem,3vw,3.6rem)] font-bold text-muted-foreground">{titulo}</p>
      <div className="relative grid size-[min(40vh,30vw)] place-items-center rounded-full bg-pd-celeste-oscuro shadow-[var(--pd-sombra-flotante)]">
        <motion.span
          key={`anillo-${n}`}
          aria-hidden
          className="absolute inset-0 rounded-full border-[0.6vh] border-pd-celeste"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            className="text-[min(26vh,20vw)] leading-none font-extrabold text-white"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0, transition: MOVIMIENTO.salida }}
            transition={MOVIMIENTO.rebote}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** La pista: un carril por alumno, siempre en el mismo orden; cada pin avanza hacia la meta. */
function Pista({ estado, recibido }: { estado: EstadoDe<'tipeo'>; recibido: number }) {
  const v = estado.vista;
  const restante = useCuentaAtras(v.restanteMs, recibido, 250);

  const terminaron = useRef(v.terminaron);
  useEffect(() => {
    if (v.terminaron > terminaron.current) sonidos.pop();
    terminaron.current = v.terminaron;
  }, [v.terminaron]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[2.5vh]">
      <div className="flex items-end justify-between gap-[2vw]">
        <div className="flex min-w-0 flex-col gap-[0.6vh]">
          <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">Carrera de tipeo</p>
          <h1 className="truncate text-[clamp(1.8rem,3.4vw,4.2rem)] leading-none font-extrabold">{v.titulo}</h1>
        </div>
        <div className="flex shrink-0 items-baseline gap-[2vw] text-[clamp(1.1rem,1.9vw,2.4rem)] font-bold tabular-nums">
          <span>
            {v.terminaron}/{v.participantes} llegaron
          </span>
          {restante !== null && <span className={cn('text-[1.4em]', restante < 10_000 && 'text-destructive')}>{formatoReloj(restante)}</span>}
        </div>
      </div>

      <Carriles corredores={v.corredores} largo={v.texto.length} />
    </div>
  );
}

/** La pista con un carril por alumno, siempre en el mismo orden. También la usa la pregunta de tipeo del quiz. */
export function Carriles({ corredores, largo, maxAlto = 66 }: { corredores: CorredorTipeo[]; largo: number; maxAlto?: number }) {
  const carriles = [...corredores].sort((a, b) => a.alumnoId - b.alumnoId);
  const cortos = nombresCortos(carriles.map((c) => ({ id: c.alumnoId, nombre: c.nombre })));
  // Con muchos alumnos los carriles se achican para que entren todos.
  const alto = Math.min(9, maxAlto / Math.max(1, carriles.length));
  const pin = Math.round(Math.min(56, (alto / 100) * window.innerHeight * 0.85));
  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-center rounded-[2.5rem] bg-card px-[2vw] py-[2vh] shadow-[var(--pd-sombra-tarjeta)]">
      {/* Meta: una franja a cuadros a la derecha. */}
      <div
        aria-hidden
        className="absolute top-[2vh] right-[calc(2vw+9rem)] bottom-[2vh] w-[1vw] opacity-60"
        style={{ backgroundImage: 'repeating-conic-gradient(var(--foreground) 0 25%, transparent 0 50%)', backgroundSize: '1vw 1vw' }}
      />
      <ol className="flex flex-col">
        {carriles.map((c, i) => (
          <Carril key={c.alumnoId} corredor={c} nombre={cortos.get(c.alumnoId) ?? c.nombre} largo={largo} alto={alto} pin={pin} par={i % 2 === 0} />
        ))}
      </ol>
    </div>
  );
}

interface PropsCarril {
  corredor: CorredorTipeo;
  nombre: string;
  largo: number;
  alto: number;
  pin: number;
  par: boolean;
}

// Llegan varios avances por segundo: solo se vuelve a dibujar el carril de quien se movió.
const Carril = memo(
  function Carril({ corredor: c, nombre, largo, alto, pin, par }: PropsCarril) {
    const avance = largo > 0 ? Math.min(1, c.posicion / largo) : 0;
    return (
      <li className={cn('flex items-center gap-[1vw] rounded-full', par && 'bg-muted/50', !c.conectado && 'opacity-40')} style={{ height: `${alto}vh` }}>
        <span className="w-[10vw] shrink-0 truncate pl-[1vw] text-[clamp(0.8rem,min(1.4vw,2.2vh),1.6rem)] font-semibold">{nombre}</span>
        {/* El recorrido: el pin se mueve con transform (x en % del propio recorrido). */}
        <div className="relative h-full min-w-0 flex-1" style={{ marginRight: pin }}>
          <motion.div
            className="absolute inset-y-0 left-0 w-full"
            initial={false}
            animate={{ x: `${avance * 100}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 0.8 }}
          >
            <div className="absolute top-1/2 left-0 -translate-y-1/2" style={{ width: pin }}>
              <PinAvatar avatar={c.avatar} tamano={pin} />
            </div>
          </motion.div>
        </div>
        <span
          className={cn(
            'w-[8rem] shrink-0 pr-[1vw] text-right text-[clamp(0.85rem,min(1.5vw,2.4vh),1.8rem)] font-bold tabular-nums',
            c.terminado && 'text-bien-texto',
          )}
        >
          {c.terminado ? `🏁 ${c.ppm}` : c.ppm} <span className="text-[0.7em] font-semibold text-muted-foreground">ppm</span>
        </span>
      </li>
    );
  },
  (a, b) =>
    a.nombre === b.nombre &&
    a.largo === b.largo &&
    a.alto === b.alto &&
    a.pin === b.pin &&
    a.par === b.par &&
    a.corredor.posicion === b.corredor.posicion &&
    a.corredor.ppm === b.corredor.ppm &&
    a.corredor.terminado === b.corredor.terminado &&
    a.corredor.conectado === b.corredor.conectado &&
    a.corredor.avatar === b.corredor.avatar,
);

const ALTO_PODIO = ['44vh', '32vh', '24vh'];
const TIEMPOS_PODIO = [2600, 1500, 500];

function Podio({ estado }: { estado: EstadoDe<'tipeo'> }) {
  const v = estado.vista;
  const top = v.corredores.filter((c) => c.posicion > 0).slice(0, 3);
  const resto = v.corredores.filter((c) => c.posicion > 0).slice(3, 12);

  useEffect(() => {
    const timers = top.map((_, i) =>
      setTimeout(() => {
        if (i === 0) {
          sonidos.fanfarria();
          tirarConfetti();
        } else sonidos.redoble(i === 2 ? 0 : 1);
      }, TIEMPOS_PODIO[i]),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.carreraId]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[2vh]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold">¡Llegada!</h1>
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">{v.titulo}</p>
        </div>
        <Logo alto={96} />
      </div>
      {top.length === 0 ? (
        <p className="m-auto text-[clamp(1.4rem,2.4vw,3rem)] font-semibold text-muted-foreground">Nadie llegó a tipear.</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-end gap-[3vw]">
          <div className="flex min-h-0 flex-1 items-end justify-center gap-[2vw]">
            {[1, 0, 2]
              .filter((i) => i < top.length)
              .map((i) => (
                <Puesto key={top[i]!.alumnoId} corredor={top[i]!} posicion={i} demora={TIEMPOS_PODIO[i]! / 1000} />
              ))}
          </div>
          {resto.length > 0 && (
            <ol className="flex w-[26vw] shrink-0 flex-col gap-[0.8vh] self-center">
              {resto.map((c, i) => (
                <motion.li
                  key={c.alumnoId}
                  className="flex items-center gap-[0.8vw] rounded-full bg-card py-[0.5vh] pr-[1.2vw] pl-[0.6vw] text-[clamp(0.9rem,1.4vw,1.7rem)] shadow-[var(--pd-sombra-tarjeta)]"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...MOVIMIENTO.suave, delay: escalon(i, 0.06, 3.2) }}
                >
                  <span className="w-[2.5vw] text-right font-bold text-muted-foreground">{ordinal(c.puesto)}</span>
                  <PinAvatar avatar={c.avatar} tamano={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</span>
                  <span className="font-bold tabular-nums">{c.ppm}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function Puesto({ corredor: c, posicion, demora }: { corredor: CorredorTipeo; posicion: number; demora: number }) {
  const primero = posicion === 0;
  return (
    <div className="flex w-[clamp(9rem,18vw,22rem)] flex-col items-center">
      <motion.div
        className="flex flex-col items-center gap-[1vh] pb-[2vh]"
        initial={{ opacity: 0, y: 60, scale: 0.6 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...MOVIMIENTO.rebote, delay: demora + 0.35 }}
      >
        <PinAvatar avatar={c.avatar} tamano={primero ? 110 : 84} />
        <span
          className={cn('max-w-full truncate text-center font-extrabold', primero ? 'text-[clamp(1.6rem,3vw,3.6rem)]' : 'text-[clamp(1.3rem,2.2vw,2.8rem)]')}
        >
          {c.nombre}
        </span>
        <span className="text-[clamp(1.1rem,1.9vw,2.4rem)] font-bold text-acento">
          {c.ppm} ppm · {c.precision}%
        </span>
      </motion.div>
      <div className="relative w-full" style={{ height: ALTO_PODIO[posicion] }}>
        <motion.div
          className={cn(
            'absolute inset-0 origin-bottom rounded-t-[2rem] shadow-[var(--pd-sombra-flotante)]',
            primero ? 'bg-pd-celeste-oscuro' : 'bg-pd-celeste',
          )}
          initial={{ scaleY: 0.05 }}
          animate={{ scaleY: 1 }}
          transition={{ ...MOVIMIENTO.crecer, delay: demora }}
        />
        <motion.span
          className={cn(
            'absolute inset-x-0 top-[2vh] text-center text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold',
            primero ? 'text-white' : 'text-pd-gris-texto',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...MOVIMIENTO.rebote, delay: demora + 0.25 }}
        >
          {c.puesto}.º
        </motion.span>
      </div>
    </div>
  );
}

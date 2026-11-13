import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { equipo, type EstadoJuego, type FilaRanking } from '@aula/shared';
import { MascotaEquipo } from '@/components/pd/Equipo';
import { Logo } from '@/components/pd/Logo';
import { Numero } from '@/components/pd/Numero';
import { PinAvatar } from '@/components/pd/Pin';
import { esLiviano } from '@/lib/liviano';
import { MOVIMIENTO } from '@/lib/movimiento';
import { sonidos } from '@/lib/sonidos';
import { cn } from '@/lib/utils';

const COLORES_MARCA = ['#3AB6E6', '#0B7DB0', '#EAF7FD', '#F25F5C', '#F5B700', '#2BB673', '#FFFFFF'];

/** Momento (ms) en que aparece cada puesto: primero el 3.º, después el 2.º y, tras un redoble, el 1.º. */
const TIEMPOS = [5400, 2700, 900];
/** El redoble arranca cuando ya está el 2.º y termina justo cuando aparece el 1.º. */
const REDOBLE_MS = 2000;
/** Fuegos artificiales después del primer estallido: cuántos y cada cuánto. */
const TANDAS = 6;
const ENTRE_TANDAS_MS = 650;

/** Confetti del festejo grande: un estallido al centro, dos desde los costados y después fuegos artificiales. Devuelve cómo cancelarlo. */
export function tirarConfetti(): () => void {
  if (esLiviano()) return () => {};
  const base = { colors: COLORES_MARCA, disableForReducedMotion: true, ticks: 260, scalar: 1.1 };
  void confetti({ ...base, particleCount: 160, spread: 100, startVelocity: 58, origin: { x: 0.5, y: 0.55 } });
  const timers = [
    setTimeout(() => {
      void confetti({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
      void confetti({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
    }, 350),
    ...Array.from({ length: TANDAS }, (_, i) =>
      setTimeout(
        () =>
          void confetti({
            ...base,
            particleCount: 70,
            spread: 360,
            startVelocity: 32,
            gravity: 0.7,
            ticks: 180,
            origin: { x: 0.12 + Math.random() * 0.76, y: 0.12 + Math.random() * 0.35 },
          }),
        1100 + i * ENTRE_TANDAS_MS,
      ),
    ),
  ];
  return () => timers.forEach(clearTimeout);
}

/** Un estallido chico de confetti que sale de un elemento (la respuesta correcta, por ejemplo). */
export function estallido(el: Element | null, cantidad = 90): void {
  if (!el || esLiviano()) return;
  const r = el.getBoundingClientRect();
  void confetti({
    colors: COLORES_MARCA,
    disableForReducedMotion: true,
    particleCount: cantidad,
    spread: 85,
    startVelocity: 42,
    ticks: 170,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
  });
}

/** Lo que se sube al podio: un alumno o, si se jugó por equipos, un equipo. */
interface Subido {
  clave: string;
  nombre: string;
  puntos: number;
  puesto: number;
  /** Avatar del alumno, o mascota y color del equipo. */
  avatar?: string;
  equipo?: number;
}

function subidos(estado: EstadoJuego): Subido[] {
  if (estado.equipos) {
    return estado.equipos
      .slice(0, 3)
      .map((f) => ({ clave: `e${f.equipo}`, nombre: equipo(f.equipo).nombre, puntos: f.puntos, puesto: f.puesto, equipo: f.equipo }));
  }
  return estado.ranking
    .slice(0, 3)
    .map((r: FilaRanking) => ({ clave: `a${r.alumnoId}`, nombre: r.nombre, puntos: r.puntos, puesto: r.puesto, avatar: r.avatar }));
}

export function Podio({ estado }: { estado: EstadoJuego }) {
  const top = subidos(estado);
  const [visibles, setVisibles] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelarConfetti = () => {};
    const timers = top.map((_, i) =>
      setTimeout(() => {
        setVisibles((v) => new Set(v).add(i));
        if (i === 0) {
          sonidos.fanfarria();
          cancelarConfetti = tirarConfetti();
        } else sonidos.redoble(i === 2 ? 0 : 1);
      }, TIEMPOS[i]),
    );
    // El suspenso antes del ganador.
    if (top.length > 0) timers.push(setTimeout(() => sonidos.redobleLargo(REDOBLE_MS / 1000), TIEMPOS[0]! - REDOBLE_MS));
    return () => {
      timers.forEach(clearTimeout);
      cancelarConfetti();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.sesionId]);

  // En pantalla: 2.º a la izquierda, 1.º al centro, 3.º a la derecha.
  const orden = [1, 0, 2].filter((i) => i < top.length);
  const hayGanador = visibles.has(0);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* El reflector del ganador: un cono de luz dorada que se enciende sobre el centro cuando aparece. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-[3vh] left-1/2 h-[104%] w-[46vw] -translate-x-1/2 bg-linear-to-b from-[rgb(255_214_102/0.26)] via-[rgb(255_214_102/0.1)] to-transparent [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: hayGanador ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <motion.h1
            className="text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={MOVIMIENTO.rebote}
          >
            ¡Podio!
          </motion.h1>
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">
            {estado.quizTitulo}
            {estado.equipos && estado.ranking[0] && `. Mejor puntaje: ${estado.ranking[0].nombre}`}
          </p>
        </div>
        <Logo alto={96} />
      </div>
      {top.length === 0 ? (
        <p className="m-auto text-[clamp(1.4rem,2.4vw,3rem)] font-semibold text-muted-foreground">Nadie jugó este quiz.</p>
      ) : (
        <div className="relative flex min-h-0 flex-1 items-end justify-center gap-[2vw] pt-[2vh]">
          {orden.map((i) => (
            <Puesto key={top[i]!.clave} fila={top[i]!} posicion={i} visible={visibles.has(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

const ALTO = ['44vh', '32vh', '24vh'];

function Puesto({ fila, posicion, visible }: { fila: Subido; posicion: number; visible: boolean }) {
  const primero = posicion === 0;
  return (
    <div className="flex w-[clamp(10rem,22vw,26rem)] flex-col items-center">
      <motion.div
        className="flex flex-col items-center gap-[1vh] pb-[2vh]"
        initial={{ opacity: 0, y: 60, scale: 0.6 }}
        animate={visible ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ ...MOVIMIENTO.rebote, delay: 0.35 }}
      >
        <div className="relative">
          {/* El ganador: un halo dorado detrás y la corona, que cae al final. */}
          {primero && (
            <span aria-hidden className="halo absolute -inset-[35%] rounded-full bg-[radial-gradient(closest-side,rgb(255_214_102/0.6),transparent)]" />
          )}
          {primero && (
            <motion.span
              aria-hidden
              className="absolute -top-[52%] left-1/2 z-10 text-[72px] leading-none"
              initial={{ opacity: 0, x: '-50%', y: -260, rotate: -25 }}
              animate={visible ? { opacity: 1, x: '-50%', y: 0, rotate: 0 } : {}}
              transition={{ ...MOVIMIENTO.impacto, delay: 0.95 }}
            >
              👑
            </motion.span>
          )}
          {/* Cada puesto, coronado con un pin */}
          <div className="relative">
            {fila.equipo !== undefined ? (
              <MascotaEquipo indice={fila.equipo} className={primero ? 'size-[120px] text-[120px]' : 'size-[92px] text-[92px]'} />
            ) : (
              <PinAvatar avatar={fila.avatar!} tamano={primero ? 120 : 92} />
            )}
          </div>
        </div>
        <span className={cn('max-w-full truncate text-center font-extrabold', primero ? 'text-[clamp(1.8rem,3.2vw,4rem)]' : 'text-[clamp(1.4rem,2.4vw,3rem)]')}>
          {fila.nombre}
        </span>
        <span className={cn('text-[clamp(1.1rem,1.9vw,2.4rem)] font-bold', primero ? 'text-pd-resp-c' : 'text-acento')}>
          {visible ? <Numero valor={fila.puntos} desde={0} duracion={1.4} /> : '0'} pts
        </span>
      </motion.div>
      {/* La columna crece escalándose desde abajo (solo transform); el número entra encima cuando ya creció. */}
      <div className="relative w-full" style={{ height: ALTO[posicion] }}>
        <motion.div
          className={cn(
            'absolute inset-0 origin-bottom overflow-hidden rounded-t-[2rem] shadow-[var(--pd-sombra-flotante)]',
            primero ? 'bg-linear-to-b from-pd-celeste to-pd-celeste-oscuro' : 'bg-pd-celeste',
          )}
          style={fila.equipo !== undefined ? { background: equipo(fila.equipo).color } : undefined}
          initial={{ scaleY: 0.05 }}
          animate={{ scaleY: visible ? 1 : 0.05 }}
          transition={MOVIMIENTO.crecer}
        >
          {/* Un brillo que recorre la columna del ganador. */}
          {primero && visible && <span aria-hidden className="brillo absolute inset-0" />}
        </motion.div>
        <motion.span
          className={cn(
            'absolute inset-x-0 top-[2vh] text-center text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold',
            primero ? 'text-white' : 'text-pd-gris-texto',
          )}
          style={fila.equipo !== undefined ? { color: equipo(fila.equipo).texto } : undefined}
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ ...MOVIMIENTO.rebote, delay: 0.25 }}
        >
          {fila.puesto}.º
        </motion.span>
      </div>
    </div>
  );
}

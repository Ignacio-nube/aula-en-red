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

/** Momento (ms) en que aparece cada puesto: primero el 3.º, después el 2.º y al final el 1.º. */
const TIEMPOS = [3000, 1700, 500];

export function tirarConfetti() {
  if (esLiviano()) return;
  const base = { colors: COLORES_MARCA, disableForReducedMotion: true, ticks: 260, scalar: 1.1 };
  void confetti({ ...base, particleCount: 140, spread: 90, startVelocity: 55, origin: { x: 0.5, y: 0.55 } });
  setTimeout(() => {
    void confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    void confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }, 350);
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
    const timers = top.map((_, i) =>
      setTimeout(() => {
        setVisibles((v) => new Set(v).add(i));
        if (i === 0) {
          sonidos.fanfarria();
          tirarConfetti();
        } else sonidos.redoble(i === 2 ? 0 : 1);
      }, TIEMPOS[i]),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.sesionId]);

  // En pantalla: 2.º a la izquierda, 1.º al centro, 3.º a la derecha.
  const orden = [1, 0, 2].filter((i) => i < top.length);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[clamp(2.4rem,5vw,6rem)] leading-none font-extrabold">¡Podio!</h1>
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
        <div className="flex min-h-0 flex-1 items-end justify-center gap-[2vw] pt-[2vh]">
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
        {/* Cada puesto, coronado con un pin */}
        {fila.equipo !== undefined ? (
          <MascotaEquipo indice={fila.equipo} className={primero ? 'size-[120px] text-[120px]' : 'size-[92px] text-[92px]'} />
        ) : (
          <PinAvatar avatar={fila.avatar!} tamano={primero ? 120 : 92} />
        )}
        <span className={cn('max-w-full truncate text-center font-extrabold', primero ? 'text-[clamp(1.8rem,3.2vw,4rem)]' : 'text-[clamp(1.4rem,2.4vw,3rem)]')}>
          {fila.nombre}
        </span>
        <span className="text-[clamp(1.1rem,1.9vw,2.4rem)] font-bold text-pd-celeste-oscuro">
          {visible ? <Numero valor={fila.puntos} desde={0} duracion={1.4} /> : '0'} pts
        </span>
      </motion.div>
      {/* La columna crece escalándose desde abajo (solo transform); el número entra encima cuando ya creció. */}
      <div className="relative w-full" style={{ height: ALTO[posicion] }}>
        <motion.div
          className={cn(
            'absolute inset-0 origin-bottom rounded-t-[2rem] shadow-[var(--pd-sombra-flotante)]',
            primero ? 'bg-pd-celeste-oscuro' : 'bg-pd-celeste',
          )}
          style={fila.equipo !== undefined ? { backgroundColor: equipo(fila.equipo).color } : undefined}
          initial={{ scaleY: 0.05 }}
          animate={{ scaleY: visible ? 1 : 0.05 }}
          transition={MOVIMIENTO.crecer}
        />
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

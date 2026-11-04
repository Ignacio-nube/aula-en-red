import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AlumnoPublico } from '@aula/shared';
import { Drive } from '@/components/drive/Drive';
import { useMiDrive } from '@/lib/drive';
import { ordinal } from '@/lib/juego';
import { esLiviano } from '@/lib/liviano';
import { MOVIMIENTO, vibrar } from '@/lib/movimiento';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { EstadoDe } from '../tipos';

interface Props {
  estado: EstadoDe<'drive'>;
  recibido: number;
  socket: SocketAula | null;
  alumno: AlumnoPublico;
  token: string;
}

/** El Drive de siempre, con la lista de misiones arriba que se tilda sola. */
export function AlumnoMisiones({ estado, socket, alumno, token }: Props) {
  const { drive, setDrive } = useMiDrive(token, socket);
  return (
    <div className="flex min-h-0 flex-1 flex-col px-0 pb-0 sm:px-3 sm:pb-3">
      <Drive
        drive={drive}
        setDrive={setDrive}
        token={token}
        dueno={alumno}
        className="overflow-hidden shadow-[var(--pd-sombra-tarjeta)] sm:rounded-3xl"
        arriba={<PanelMisiones estado={estado} />}
      />
    </div>
  );
}

function PanelMisiones({ estado }: { estado: EstadoDe<'drive'> }) {
  const v = estado.vista;
  const hechos = v.yo?.hechos ?? v.pasos.map(() => false);
  const cuantos = hechos.filter(Boolean).length;
  const todo = cuantos === v.pasos.length;
  const [abierto, setAbierto] = useState(true);
  const antes = useRef(hechos);

  // Al tildarse una misión: un toque de vibración; al completar todas, papel picado.
  useEffect(() => {
    const nuevas = hechos.filter((h, i) => h && !antes.current[i]).length;
    antes.current = hechos;
    if (nuevas === 0) return;
    vibrar(todo ? [40, 60, 40, 60, 120] : 40);
    if (todo && !esLiviano()) void confetti({ particleCount: 90, spread: 80, origin: { y: 0.3 }, disableForReducedMotion: true, ticks: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hechos.join()]);

  return (
    <section
      aria-label="Misiones"
      className="mx-3 mt-3 overflow-hidden rounded-2xl bg-pd-celeste-claro ring-1 ring-pd-celeste/40 sm:mx-5 dark:bg-pd-celeste-oscuro/25"
    >
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', todo ? 'bg-[#188038] text-white' : 'bg-pd-celeste-oscuro text-white')}>
          {todo ? <Check className="size-5" strokeWidth={3} /> : <Target className="size-5" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{v.titulo}</span>
          <span className="text-sm text-muted-foreground" role="status">
            {v.fase === 'fin'
              ? 'El profe terminó las misiones.'
              : todo
                ? `¡Completaste todas!${v.yo?.puesto ? ` Llegaste ${ordinal(v.yo.puesto)}.` : ''}`
                : `${cuantos} de ${v.pasos.length} hechas`}
          </span>
        </span>
        <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-card sm:block" aria-hidden>
          <motion.span
            className="block h-full rounded-full bg-pd-celeste-oscuro"
            animate={{ width: `${(cuantos / v.pasos.length) * 100}%` }}
            transition={MOVIMIENTO.suave}
          />
        </span>
        <ChevronDown className={cn('size-5 shrink-0 transition-transform', abierto && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ol
            className="flex flex-col gap-1 px-4 pb-3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={MOVIMIENTO.suave}
          >
            {v.pasos.map((texto, i) => (
              <li key={i} className="flex items-center gap-3 py-0.5">
                <motion.span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full ring-2',
                    hechos[i] ? 'bg-[#188038] text-white ring-[#188038]' : 'bg-card text-transparent ring-foreground/20',
                  )}
                  animate={hechos[i] ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <Check className="size-4" strokeWidth={3} />
                </motion.span>
                <span className={cn('text-sm sm:text-base', hechos[i] && 'text-muted-foreground line-through')}>{texto}</span>
                <span className="sr-only">{hechos[i] ? '(hecha)' : '(falta)'}</span>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}

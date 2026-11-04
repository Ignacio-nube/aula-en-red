import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { CARITAS_ESCALA, type AlumnoPublico } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { emitirConAck } from '@/lib/juego';
import { esLiviano } from '@/lib/liviano';
import { MOVIMIENTO, vibrar } from '@/lib/movimiento';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { EstadoDe } from '../tipos';
import { BarrasCaritas } from './Pantalla';

interface Props {
  estado: EstadoDe<'galeria'>;
  recibido: number;
  socket: SocketAula | null;
  alumno: AlumnoPublico;
  token: string;
}

export function AlumnoGaleria({ estado, socket, alumno }: Props) {
  const v = estado.vista;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={v.fase === 'podio' ? 'podio' : `img-${v.imagen?.id}`}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, x: -40, transition: MOVIMIENTO.salida }}
      >
        {v.fase === 'podio' ? <Podio estado={estado} alumno={alumno} /> : <Votar estado={estado} socket={socket} />}
      </motion.div>
    </AnimatePresence>
  );
}

function Votar({ estado, socket }: { estado: EstadoDe<'galeria'>; socket: SocketAula | null }) {
  const v = estado.vista;
  const [enviando, setEnviando] = useState<number | null>(null);
  const [local, setLocal] = useState<number | null>(null);
  const elegida = local ?? v.miVoto ?? null;
  useEffect(() => setLocal(null), [v.imagen?.id]);

  const votar = async (valor: number) => {
    if (!v.imagen) return;
    setLocal(valor);
    setEnviando(valor);
    vibrar(25);
    const r = await emitirConAck(socket, 'actividad:enviar', { imagenId: v.imagen.id, valor });
    setEnviando(null);
    if (!r.ok) {
      setLocal(null);
      toast.error(r.error);
    }
  };

  if (!v.imagen) return null;
  const abierta = v.fase === 'votando';

  return (
    <div className="m-auto flex w-full max-w-3xl flex-col items-center gap-4 bajo:gap-2">
      <p className="text-sm font-semibold text-muted-foreground">
        {v.titulo} · Dibujo {v.indice + 1} de {v.total}
      </p>
      <div className="relative flex w-full justify-center">
        <img
          src={v.imagen.url}
          alt={`Dibujo ${v.indice + 1}`}
          className={cn(
            'w-full object-contain drop-shadow-[0_12px_24px_rgb(16_42_67/0.2)] transition-[height]',
            v.fase === 'revelada' ? 'h-[26dvh]' : 'h-[42dvh] bajo:h-[38dvh]',
          )}
        />
        {v.imagen.autor && (
          <span className="absolute -bottom-4 flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1 font-semibold shadow-[var(--pd-sombra-tarjeta)]">
            <PinAvatar avatar={v.imagen.autor.avatar} tamano={28} />
            {v.imagen.autor.nombre}
          </span>
        )}
      </div>

      {v.esMio ? (
        <p className="mt-4 rounded-full bg-pd-celeste-claro px-5 py-2 text-lg font-bold text-pd-celeste-oscuro dark:bg-pd-celeste-oscuro/30 dark:text-pd-celeste">
          ¡Es tu dibujo! Mirá cómo lo votan
        </p>
      ) : (
        <>
          <h1 className="mt-4 text-center text-2xl font-extrabold text-balance sm:text-3xl">
            {!abierta ? 'Ya se cerró la votación de este dibujo' : elegida === null ? '¿Qué te parece?' : '¡Listo! Podés cambiar tu voto'}
          </h1>
          <div className="grid w-full max-w-xl grid-cols-5 gap-2 sm:gap-3">
            {CARITAS_ESCALA.map((carita, i) => (
              <motion.button
                key={i}
                type="button"
                disabled={!abierta || enviando !== null}
                whileTap={{ scale: 0.88 }}
                animate={{ scale: elegida === i ? 1.1 : 1, opacity: elegida !== null && elegida !== i ? 0.4 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                aria-label={`${i + 1} de 5`}
                aria-pressed={elegida === i}
                onClick={() => void votar(i)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-3xl bg-card text-[clamp(2rem,9vw,3.5rem)] shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default',
                  elegida === i && 'ring-3 ring-pd-celeste',
                )}
              >
                <span aria-hidden>{carita}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {v.fase === 'revelada' && v.resultados && (
        <div className="w-full max-w-xl rounded-3xl bg-card p-4 shadow-[var(--pd-sombra-tarjeta)]">
          <BarrasCaritas resultados={v.resultados} promedio={v.promedio} compacto />
        </div>
      )}
    </div>
  );
}

function Podio({ estado, alumno }: { estado: EstadoDe<'galeria'>; alumno: AlumnoPublico }) {
  const v = estado.vista;
  const mio = v.podio.find((p) => p.autor?.nombre === alumno.nombre && p.autor.avatar === alumno.avatar);
  useEffect(() => {
    if (!mio || esLiviano()) return;
    void confetti({ particleCount: 100, spread: 90, origin: { y: 0.6 }, disableForReducedMotion: true, ticks: 200 });
  }, [mio]);

  return (
    <div className="m-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center">
      <h1 className="text-4xl font-extrabold sm:text-5xl">¡Terminó la votación!</h1>
      {mio && (
        <p className="rounded-full bg-pd-celeste-claro px-5 py-2 text-lg font-bold text-pd-celeste-oscuro dark:bg-pd-celeste-oscuro/30 dark:text-pd-celeste">
          ¡Tu dibujo quedó en el puesto {mio.puesto}!
        </p>
      )}
      <ol className="flex w-full flex-col gap-3">
        {v.podio.map((p) => (
          <li key={p.imagenId} className="flex items-center gap-4 rounded-3xl bg-card p-3 text-left shadow-[var(--pd-sombra-tarjeta)]">
            <span className="text-4xl" aria-label={`Puesto ${p.puesto}`}>
              {['🥇', '🥈', '🥉'][p.puesto - 1]}
            </span>
            <img src={p.url} alt="" className="size-20 shrink-0 rounded-2xl bg-muted object-cover" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {p.autor ? (
                <span className="flex items-center gap-2 font-bold">
                  <PinAvatar avatar={p.autor.avatar} tamano={24} />
                  <span className="truncate">{p.autor.nombre}</span>
                </span>
              ) : (
                <span className="font-bold">Dibujo anónimo</span>
              )}
              <span className="text-sm text-muted-foreground">
                {p.promedio.toLocaleString('es-AR')} de 5 · {p.votos} {p.votos === 1 ? 'voto' : 'votos'}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {v.podio.length === 0 && <p className="text-lg text-muted-foreground">Nadie votó esta vez.</p>}
    </div>
  );
}

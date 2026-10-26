import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITE_RESPUESTA_TEXTO, type Atencion, type EncuestaEnVivo } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { emitirConAck } from '@/lib/juego';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';

/** Encuesta rápida o ticket de salida. Se puede cambiar la respuesta mientras esté abierta. */
export function EncuestaAlumno({ encuesta: e, socket }: { encuesta: EncuestaEnVivo; socket: SocketAula | null }) {
  const [enviando, setEnviando] = useState<number | 'texto' | null>(null);
  const elegida = typeof e.miRespuesta === 'number' ? e.miRespuesta : null;

  const responder = async (valor: number | string) => {
    setEnviando(typeof valor === 'number' ? valor : 'texto');
    const r = await emitirConAck(socket, 'encuesta:responder', valor);
    setEnviando(null);
    if (!r.ok) toast.error(r.error);
    return r.ok;
  };

  const total = e.resultados?.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <motion.div
        className="m-auto flex w-full max-w-2xl flex-col gap-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{e.tipo === 'texto' ? 'Ticket de salida' : 'Encuesta'}</Badge>
            {e.anonima && (
              <Badge variant="outline">
                <Lock data-icon="inline-start" />
                Anónima
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-balance sm:text-4xl">{e.pregunta}</h1>
          <p className="text-muted-foreground">
            {!e.abierta
              ? 'La encuesta se cerró. ¡Gracias por participar!'
              : e.miRespuesta !== null && e.miRespuesta !== undefined
                ? '¡Listo! Podés cambiar tu respuesta mientras siga abierta.'
                : e.anonima
                  ? 'Nadie va a saber qué respondiste.'
                  : 'El profe va a ver tu nombre junto a tu respuesta.'}
          </p>
        </div>

        {e.tipo === 'escala' && (
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {e.opciones.map((carita, i) => (
              <motion.button
                key={i}
                type="button"
                disabled={!e.abierta || enviando !== null}
                whileTap={{ scale: 0.9 }}
                animate={{ scale: elegida === i ? 1.08 : 1, opacity: elegida !== null && elegida !== i ? 0.45 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                aria-label={`${i + 1} de 5`}
                aria-pressed={elegida === i}
                onClick={() => void responder(i)}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-3xl bg-card text-[clamp(2rem,9vw,3.5rem)] shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  elegida === i && 'ring-3 ring-pd-celeste',
                )}
              >
                <span aria-hidden>{carita}</span>
                {e.resultados && <span className="text-sm font-bold text-muted-foreground tabular-nums">{e.resultados[i]}</span>}
              </motion.button>
            ))}
          </div>
        )}

        {e.tipo === 'opciones' && (
          <ul className="flex flex-col gap-2.5">
            {e.opciones.map((o, i) => {
              const votos = e.resultados?.[i] ?? 0;
              const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
              return (
                <li key={i}>
                  <motion.button
                    type="button"
                    disabled={!e.abierta || enviando !== null}
                    whileTap={{ scale: 0.97 }}
                    aria-pressed={elegida === i}
                    onClick={() => void responder(i)}
                    className={cn(
                      'relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-card px-4 py-3.5 text-left text-lg font-semibold shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      elegida === i && 'ring-2 ring-pd-celeste',
                    )}
                  >
                    {e.resultados && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-y-0 left-0 bg-pd-celeste-claro"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      />
                    )}
                    <span
                      className={cn(
                        'relative grid size-7 shrink-0 place-items-center rounded-full ring-2',
                        elegida === i ? 'bg-pd-celeste-oscuro text-white ring-pd-celeste-oscuro' : 'ring-border',
                      )}
                    >
                      {enviando === i ? <Spinner className="size-4" /> : elegida === i && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="relative min-w-0 flex-1">{o}</span>
                    {e.resultados && <span className="relative text-base tabular-nums">{pct}%</span>}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        )}

        {e.tipo === 'texto' && <RespuestaTexto encuesta={e} enviando={enviando === 'texto'} onEnviar={responder} />}
      </motion.div>
    </div>
  );
}

function RespuestaTexto({ encuesta: e, enviando, onEnviar }: { encuesta: EncuestaEnVivo; enviando: boolean; onEnviar: (v: string) => Promise<boolean> }) {
  const enviada = typeof e.miRespuesta === 'string' ? e.miRespuesta : '';
  const [texto, setTexto] = useState(enviada);
  useEffect(() => setTexto(enviada), [enviada]);

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    if (texto.trim()) void onEnviar(texto);
  };

  if (!e.abierta) {
    return enviada ? <p className="rounded-2xl bg-card p-4 text-lg shadow-[var(--pd-sombra-tarjeta)]">{enviada}</p> : null;
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Textarea
        aria-label="Tu respuesta"
        rows={4}
        maxLength={LIMITE_RESPUESTA_TEXTO}
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        className="text-lg"
        placeholder="Escribí acá…"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {texto.length}/{LIMITE_RESPUESTA_TEXTO}
        </span>
        <Button type="submit" size="lg" disabled={!texto.trim() || enviando || texto === enviada}>
          {enviando ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          {enviada ? 'Actualizar' : 'Enviar'}
        </Button>
      </div>
    </form>
  );
}

/** "Miren al frente": tapa toda la pantalla del alumno hasta que el profe lo saque. */
export function PantallaAtencion({ atencion }: { atencion: Atencion | null }) {
  return (
    <AnimatePresence>
      {atencion && (
        <motion.div
          key="atencion"
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-pd-celeste-oscuro px-6 text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <motion.span
            aria-hidden
            className="text-[clamp(5rem,22vw,11rem)] leading-none"
            initial={{ scale: 0.3, y: 40 }}
            animate={{ scale: 1, y: 0, x: [0, -14, 14, 0] }}
            transition={{ scale: { type: 'spring', stiffness: 260, damping: 14 }, y: { type: 'spring', stiffness: 260, damping: 14 }, x: { duration: 2.4, repeat: Infinity, delay: 0.6 } }}
          >
            👀
          </motion.span>
          <motion.h1
            className="text-[clamp(2.2rem,7vw,5rem)] leading-tight font-extrabold text-balance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 26 }}
          >
            {atencion.mensaje}
          </motion.h1>
          <p className="text-lg text-white">El profe te va a devolver la pantalla en un ratito.</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

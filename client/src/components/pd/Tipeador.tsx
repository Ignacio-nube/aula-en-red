import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Keyboard, Pause } from 'lucide-react';
import { calcularPpm, calcularPrecision, type ProgresoTipeo } from '@aula/shared';
import { formatoReloj } from '@/lib/actividad';
import { esLiviano } from '@/lib/liviano';
import { vibrar } from '@/lib/movimiento';
import { cn } from '@/lib/utils';

/** Cada cuánto se manda el avance al servidor. */
const ENVIO_MS = 250;

interface Props {
  texto: string;
  /** Lo que ya tiene el servidor (si se recargó la página o se cortó la conexión, retoma desde ahí). */
  servidor?: { posicion: number; errores: number };
  /** Desde cuándo corre (ms) según el servidor, y cuándo llegó ese dato (performance.now). */
  transcurridoMs: number;
  recibido: number;
  /** Lo que queda (ms), si hay límite. */
  restanteMs?: number | null;
  pausado?: boolean;
  /** Algo más para la fila de datos (por ejemplo, el temporizador del quiz). */
  extra?: ReactNode;
  enviar: (p: ProgresoTipeo) => void;
  /** Lo que se muestra al llegar al final. */
  terminado: (datos: { ppm: number; precision: number }) => ReactNode;
}

/**
 * Tipear un texto: la letra que toca está marcada; si te equivocás se pone roja y no avanza hasta que
 * pongas la correcta. El avance vive acá (cada tecla no puede esperar al servidor) y se manda seguido.
 * Lo usan la carrera de tipeo (actividad) y la pregunta de tipeo del quiz.
 */
export function Tipeador({ texto, servidor, transcurridoMs, recibido, restanteMs, pausado, extra, enviar: alEnviar, terminado }: Props) {
  const [posicion, setPosicion] = useState(servidor?.posicion ?? 0);
  const [errores, setErrores] = useState(servidor?.errores ?? 0);
  const [error, setError] = useState(false);
  const [enfocado, setEnfocado] = useState(true);
  const pos = useRef(posicion);
  const errs = useRef(errores);
  const enviado = useRef({ posicion: -1, errores: -1 });
  const input = useRef<HTMLInputElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  // Desde cuándo corre, en el reloj de esta compu.
  const inicioLocal = useRef(recibido - transcurridoMs);
  const [, setTick] = useState(0);
  const listo = posicion >= texto.length;

  useEffect(() => {
    if (servidor && servidor.posicion > pos.current) {
      pos.current = servidor.posicion;
      setPosicion(servidor.posicion);
    }
    if (servidor && servidor.errores > errs.current) {
      errs.current = servidor.errores;
      setErrores(servidor.errores);
    }
  }, [servidor]);

  // En pausa el reloj del servidor se frena: al volver, se toma de nuevo su tiempo.
  useEffect(() => {
    inicioLocal.current = recibido - transcurridoMs;
  }, [recibido, transcurridoMs]);

  const enviarRef = useRef(alEnviar);
  enviarRef.current = alEnviar;
  const enviar = useCallback(() => {
    const p = { posicion: pos.current, errores: errs.current };
    if (p.posicion === enviado.current.posicion && p.errores === enviado.current.errores) return;
    enviado.current = p;
    enviarRef.current(p);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      enviar();
      setTick((t) => t + 1); // para refrescar las ppm en pantalla
    }, ENVIO_MS);
    return () => clearInterval(id);
  }, [enviar]);

  const procesar = (escrito: string) => {
    if (pausado) return;
    for (const letra of escrito) {
      if (pos.current >= texto.length) break;
      if (letra === texto[pos.current]) {
        pos.current += 1;
        setError(false);
      } else {
        errs.current += 1;
        setError(true);
        vibrar(25);
      }
    }
    setPosicion(pos.current);
    setErrores(errs.current);
    if (pos.current >= texto.length) {
      enviar();
      vibrar([30, 60, 30]);
    }
  };

  // El cursor siempre a la vista, aunque el texto sea largo o la pantalla chica.
  useLayoutEffect(() => {
    cursor.current?.scrollIntoView({ block: 'nearest', behavior: esLiviano() ? 'auto' : 'smooth' });
  }, [posicion]);

  useEffect(() => input.current?.focus(), []);

  const ms = pausado ? transcurridoMs : performance.now() - inicioLocal.current;
  const ppm = calcularPpm(posicion, ms);
  const precision = calcularPrecision(posicion, errores);

  if (listo) return <>{terminado({ ppm, precision })}</>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {extra}
        <Dato valor={ppm} etiqueta="palabras por minuto" />
        <Dato valor={`${precision}%`} etiqueta="precisión" />
        <Dato valor={`${Math.floor((posicion / texto.length) * 100)}%`} etiqueta="del texto" />
        {restanteMs != null && <Dato valor={formatoReloj(restanteMs)} etiqueta="quedan" destacado={restanteMs < 10_000} />}
      </div>

      {/* El input está escondido abajo del texto: así funciona igual con teclado físico y en el celu. */}
      <div
        className={cn(
          'relative min-h-0 flex-1 cursor-text overflow-y-auto rounded-3xl bg-card p-5 font-mono text-[clamp(1.15rem,2.2vw,1.75rem)] leading-relaxed shadow-[var(--pd-sombra-tarjeta)] ring-2 transition-[box-shadow] sm:p-7',
          enfocado ? 'ring-pd-celeste' : 'ring-transparent',
        )}
        onClick={() => input.current?.focus()}
      >
        <p className="break-words whitespace-pre-wrap" aria-label="Texto para tipear">
          <span className="text-muted-foreground/70">{texto.slice(0, posicion)}</span>
          <span
            ref={cursor}
            // La clave cambia con cada error: así el temblor se repite en cada tecla mal.
            key={error ? `e${errores}` : 'ok'}
            className={cn(
              'relative rounded-md border-b-4 transition-colors',
              error
                ? 'inline-block animate-[temblor_0.18s] border-destructive bg-destructive/20 text-destructive'
                : 'border-pd-celeste-oscuro bg-pd-celeste-claro',
            )}
          >
            {texto[posicion] === ' ' ? ' ' : texto[posicion]}
          </span>
          <span>{texto.slice(posicion + 1)}</span>
        </p>
        <input
          ref={input}
          aria-label="Escribí acá"
          className="absolute top-0 left-0 size-px opacity-0"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            // Enter y Tab no son parte del texto; Tab además sacaría el foco.
            if (e.key === 'Tab' || e.key === 'Enter') e.preventDefault();
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            // Con las teclas "muertas" (tildes) se espera a que termine de armarse la letra.
            if ((e.nativeEvent as InputEvent).isComposing) return;
            procesar(el.value);
            el.value = '';
          }}
          onCompositionEnd={(e) => {
            procesar(e.currentTarget.value);
            e.currentTarget.value = '';
          }}
        />
        <AnimatePresence>
          {(!enfocado || pausado) && (
            <motion.div
              className="vidrio absolute inset-0 grid place-items-center rounded-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="flex items-center gap-2 rounded-full bg-card px-5 py-3 font-sans text-lg font-bold shadow-[var(--pd-sombra-flotante)]">
                {pausado ? <Pause className="size-6" /> : <Keyboard className="size-6" />}
                {pausado ? 'En pausa' : 'Tocá acá para seguir tipeando'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Dato({ valor, etiqueta, destacado }: { valor: number | string; etiqueta: string; destacado?: boolean }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className={cn('text-3xl font-extrabold tabular-nums sm:text-4xl', destacado && 'text-destructive')}>{valor}</span>
      <span className="text-sm font-medium text-muted-foreground">{etiqueta}</span>
    </p>
  );
}

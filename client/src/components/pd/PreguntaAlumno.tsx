import { useEffect, useState, type ReactNode } from 'react';
import { LayoutGroup, motion, Reorder, useDragControls } from 'motion/react';
import { ArrowDown, ArrowUp, Check, GripVertical, Keyboard, Send, X } from 'lucide-react';
import type { OpcionEnJuego, PreguntaEnJuego, ProgresoTipeo, RespuestaJuego } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { urlImagen } from '@/lib/juego';
import { MOVIMIENTO } from '@/lib/movimiento';
import { useCompacto } from '@/lib/pantalla';
import { cn } from '@/lib/utils';
import { BotonRespuesta } from './Respuesta';
import { Temporizador } from './Temporizador';
import { Tipeador } from './Tipeador';

interface Props {
  pregunta: PreguntaEnJuego;
  indice: number;
  total: number;
  restanteMs: number;
  totalMs: number;
  pausado?: boolean;
  /** Opción que eligió (si ya respondió una de una sola opción). */
  elegida: number | null;
  /** Mientras manda la respuesta, o si ya respondió. */
  bloqueado: boolean;
  onResponder?: (respuesta: RespuestaJuego) => void;
}

/** Lo que ve el alumno durante una pregunta. También es la vista previa del editor. */
export function PreguntaAlumno({ pregunta, indice, total, restanteMs, totalMs, pausado, elegida, bloqueado, onResponder }: Props) {
  const compacto = useCompacto();
  // En la vista previa del editor, la carrera de tipeo se puede probar (no manda nada).
  const [montada] = useState(() => performance.now());
  if (pregunta.tipo === 'tipeo') {
    return (
      <PreguntaTipeo
        pregunta={pregunta}
        indice={indice}
        total={total}
        restanteMs={restanteMs}
        totalMs={totalMs}
        transcurridoMs={0}
        recibido={montada}
        enviar={() => {}}
      />
    );
  }
  const ayuda = pregunta.tipo === 'varias' ? 'Marcá todas las correctas' : pregunta.tipo === 'ordenar' ? 'Ponelos en orden' : null;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:p-6 bajo:gap-2 bajo:py-2">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Pregunta {indice + 1} de {total}
            </span>
            {pregunta.multiplicador === 2 && <Badge>Puntos dobles</Badge>}
            {pregunta.multiplicador === 0 && <Badge variant="secondary">Sin puntos</Badge>}
            {ayuda && <Badge variant="outline">{ayuda}</Badge>}
          </div>
          <h1 className="text-[clamp(1.2rem,2.6vw,2.2rem)] leading-tight font-extrabold text-pretty bajo:text-lg">{pregunta.texto}</h1>
        </div>
        <Temporizador restanteMs={restanteMs} totalMs={totalMs} pausado={pausado} tamano={compacto ? 56 : 84} />
      </div>

      {pregunta.imagen && (
        <div className="flex min-h-0 shrink justify-center">
          <img
            src={urlImagen(pregunta.imagen)}
            alt=""
            className="max-h-[28vh] min-h-0 rounded-2xl object-contain shadow-[var(--pd-sombra-tarjeta)] bajo:max-h-[20vh]"
          />
        </div>
      )}

      {pregunta.tipo === 'ordenar' ? (
        <Ordenar pregunta={pregunta} bloqueado={bloqueado || !onResponder} onResponder={onResponder} />
      ) : pregunta.tipo === 'varias' ? (
        <Varias pregunta={pregunta} bloqueado={bloqueado || !onResponder} onResponder={onResponder} />
      ) : (
        <Una pregunta={pregunta} elegida={elegida} bloqueado={bloqueado || !onResponder} onResponder={onResponder} />
      )}
    </div>
  );
}

interface PropsTipeo {
  pregunta: PreguntaEnJuego;
  indice: number;
  total: number;
  restanteMs: number;
  totalMs: number;
  pausado?: boolean;
  servidor?: { posicion: number; errores: number };
  transcurridoMs: number;
  recibido: number;
  enviar: (p: ProgresoTipeo) => void;
  /** Lo que se ve al llegar (por defecto, "¡Llegaste!"). */
  terminado?: (datos: { ppm: number; precision: number }) => ReactNode;
}

/** Carrera de tipeo en medio del quiz: el texto de la pregunta es lo que hay que tipear. */
export function PreguntaTipeo({ pregunta, indice, total, restanteMs, totalMs, pausado, servidor, transcurridoMs, recibido, enviar, terminado }: PropsTipeo) {
  const compacto = useCompacto();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:px-6 sm:pt-6">
        <span className="text-sm font-semibold text-muted-foreground">
          Pregunta {indice + 1} de {total}
        </span>
        <Badge className="gap-1">
          <Keyboard />
          Carrera de tipeo
        </Badge>
        {pregunta.multiplicador === 2 && <Badge>Puntos dobles</Badge>}
        {pregunta.multiplicador === 0 && <Badge variant="secondary">Sin puntos</Badge>}
      </div>
      <Tipeador
        texto={pregunta.texto}
        servidor={servidor}
        transcurridoMs={transcurridoMs}
        recibido={recibido}
        pausado={pausado}
        extra={<Temporizador restanteMs={restanteMs} totalMs={totalMs} pausado={pausado} tamano={compacto ? 48 : 64} />}
        enviar={enviar}
        terminado={
          terminado ??
          (({ ppm, precision }) => (
            <div className="m-auto flex flex-col items-center gap-3 p-6 text-center">
              <span className="text-7xl" aria-hidden>
                🏁
              </span>
              <h1 className="text-4xl font-extrabold">¡Llegaste!</h1>
              <p className="text-2xl font-bold text-acento">
                {ppm} palabras por minuto, {precision}% de precisión
              </p>
            </div>
          ))
        }
      />
    </div>
  );
}

interface PropsTipo {
  pregunta: PreguntaEnJuego;
  bloqueado: boolean;
  onResponder?: (r: RespuestaJuego) => void;
}

function Grilla({ pregunta, children }: { pregunta: PreguntaEnJuego; children: ReactNode }) {
  const vf = pregunta.tipo === 'vf';
  return (
    // Con poca altura (celu acostado) las 4 opciones van en 2 × 2 igual, y nunca más bajas que un dedo.
    <div
      className={cn(
        'grid min-h-0 flex-1 auto-rows-[minmax(3.25rem,1fr)] gap-2.5 sm:gap-4',
        vf ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 bajo:grid-cols-2',
        pregunta.opciones.length > 2 && 'sm:grid-rows-2',
      )}
    >
      {children}
    </div>
  );
}

/** Opción múltiple o verdadero/falso: un toque y listo. */
function Una({ pregunta, elegida, bloqueado, onResponder }: PropsTipo & { elegida: number | null }) {
  return (
    <Grilla pregunta={pregunta}>
      {pregunta.opciones.map((o, i) => (
        <BotonRespuesta
          key={o.id}
          tipo={pregunta.tipo}
          indice={i}
          texto={o.texto}
          disabled={bloqueado}
          apagado={elegida !== null && elegida !== o.id}
          onClick={() => onResponder?.(o.id)}
          className={cn('h-full', pregunta.tipo === 'vf' && 'justify-center')}
          marca={
            elegida === o.id ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/30">
                <Check className="size-6" strokeWidth={3} />
              </span>
            ) : undefined
          }
        />
      ))}
    </Grilla>
  );
}

/** Varias correctas: se marcan y se manda todo junto. */
function Varias({ pregunta, bloqueado, onResponder }: PropsTipo) {
  const [marcadas, setMarcadas] = useState<number[]>([]);
  useEffect(() => setMarcadas([]), [pregunta.id]);
  const cambiar = (id: number) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <>
      <Grilla pregunta={pregunta}>
        {pregunta.opciones.map((o, i) => {
          const marcada = marcadas.includes(o.id);
          return (
            <BotonRespuesta
              key={o.id}
              tipo={pregunta.tipo}
              indice={i}
              texto={o.texto}
              disabled={bloqueado}
              apagado={marcadas.length > 0 && !marcada}
              presionado={marcada}
              onClick={() => cambiar(o.id)}
              className="h-full"
              marca={
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl ring-3 ring-current/60', marcada && 'bg-white/35')}>
                  {marcada && <Check className="size-6" strokeWidth={3} />}
                </span>
              }
            />
          );
        })}
      </Grilla>
      <Button size="lg" className="h-14 flex-none text-lg" disabled={bloqueado || marcadas.length === 0} onClick={() => onResponder?.(marcadas)}>
        <Send data-icon="inline-start" />
        {marcadas.length === 0 ? 'Marcá al menos una' : marcadas.length === 1 ? 'Mandar 1 respuesta' : `Mandar ${marcadas.length} respuestas`}
      </Button>
    </>
  );
}

/**
 * Ordenar pasos. Lo más rápido con el dedo es tocarlos en orden: cada toque sube el paso a "tu orden"
 * con el número que sigue. Después se pueden acomodar arrastrando la tarjeta entera o con las flechas,
 * y sacar uno con la X para que vuelva abajo.
 */
function Ordenar({ pregunta, bloqueado, onResponder }: PropsTipo) {
  const [orden, setOrden] = useState<OpcionEnJuego[]>([]);
  const clave = pregunta.opciones.map((o) => o.id).join(',');
  useEffect(() => setOrden([]), [pregunta.id, clave]);
  const sueltos = pregunta.opciones.filter((o) => !orden.some((x) => x.id === o.id));
  const completo = sueltos.length === 0;

  const poner = (o: OpcionEnJuego) =>
    setOrden((actual) => {
      const n = [...actual, o];
      // Si queda uno solo, no hay nada que pensar: va último.
      const resto = pregunta.opciones.filter((x) => !n.some((y) => y.id === x.id));
      return resto.length === 1 ? [...n, resto[0]!] : n;
    });
  const sacar = (id: number) => setOrden((actual) => actual.filter((x) => x.id !== id));
  const mover = (i: number, d: -1 | 1) =>
    setOrden((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  return (
    <LayoutGroup id={`ordenar-${pregunta.id}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
        {orden.length > 0 && (
          <Reorder.Group axis="y" values={orden} onReorder={(n) => !bloqueado && setOrden(n)} className="flex flex-col gap-2" aria-label="Tu orden">
            {orden.map((o, i) => (
              <Paso key={o.id} opcion={o} posicion={i} total={orden.length} bloqueado={bloqueado} onMover={(d) => mover(i, d)} onSacar={() => sacar(o.id)} />
            ))}
          </Reorder.Group>
        )}
        {sueltos.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-sm font-semibold text-muted-foreground">
              {orden.length === 0 ? 'Tocá los pasos en el orden correcto' : `Tocá el paso ${orden.length + 1}`}
            </p>
            <ul className="flex flex-col gap-2">
              {sueltos.map((o) => (
                <motion.li key={o.id} layoutId={`paso-${o.id}`} transition={MOVIMIENTO.suave}>
                  <motion.button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => poner(o)}
                    whileTap={{ scale: 0.97 }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-pd-celeste-oscuro/40 bg-card/60 px-4 py-2 text-left text-lg font-bold outline-none hover:border-pd-celeste-oscuro hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-base text-muted-foreground" aria-hidden>
                      ?
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">{o.texto}</span>
                  </motion.button>
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button size="lg" className="h-14 flex-none text-lg" disabled={bloqueado || !completo} onClick={() => onResponder?.(orden.map((o) => o.id))}>
        <Send data-icon="inline-start" />
        {completo ? 'Mandar este orden' : sueltos.length === 1 ? 'Falta 1 paso' : `Faltan ${sueltos.length} pasos`}
      </Button>
    </LayoutGroup>
  );
}

interface PropsPaso {
  opcion: OpcionEnJuego;
  posicion: number;
  total: number;
  bloqueado: boolean;
  onMover: (d: -1 | 1) => void;
  onSacar: () => void;
}

function Paso({ opcion, posicion, total, bloqueado, onMover, onSacar }: PropsPaso) {
  const arrastre = useDragControls();
  return (
    <Reorder.Item
      value={opcion}
      layoutId={`paso-${opcion.id}`}
      dragListener={false}
      dragControls={arrastre}
      transition={MOVIMIENTO.suave}
      // Se agarra la tarjeta entera, salvo los botones (que siguen siendo toques).
      onPointerDown={(e) => {
        if (bloqueado || (e.target as HTMLElement).closest('button')) return;
        arrastre.start(e);
      }}
      className={cn(
        'flex min-h-14 flex-none touch-none items-center gap-2 rounded-2xl bg-card py-2 pr-1.5 pl-2 text-lg font-bold shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 select-none',
        !bloqueado && 'cursor-grab active:cursor-grabbing',
      )}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--pd-sombra-flotante)', zIndex: 10 }}
    >
      <GripVertical className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-base text-white tabular-nums">{posicion + 1}</span>
      <span className="min-w-0 flex-1 leading-tight">{opcion.texto}</span>
      {/* En el celu se arrastra con el dedo: las flechas quedan para la compu (y el teclado). */}
      <Button
        variant="ghost"
        size="icon"
        className="max-sm:hidden"
        aria-label={`Subir "${opcion.texto}"`}
        disabled={bloqueado || posicion === 0}
        onClick={() => onMover(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="max-sm:hidden"
        aria-label={`Bajar "${opcion.texto}"`}
        disabled={bloqueado || posicion === total - 1}
        onClick={() => onMover(1)}
      >
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Sacar "${opcion.texto}"`} disabled={bloqueado} onClick={onSacar}>
        <X />
      </Button>
    </Reorder.Item>
  );
}

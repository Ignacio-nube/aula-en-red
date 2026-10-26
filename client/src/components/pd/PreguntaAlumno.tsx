import { useEffect, useState, type ReactNode } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ArrowDown, ArrowUp, Check, GripVertical, Send } from 'lucide-react';
import type { OpcionEnJuego, PreguntaEnJuego, RespuestaJuego } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { urlImagen } from '@/lib/juego';
import { useCompacto } from '@/lib/pantalla';
import { cn } from '@/lib/utils';
import { BotonRespuesta } from './Respuesta';
import { Temporizador } from './Temporizador';

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
  const ayuda =
    pregunta.tipo === 'varias' ? 'Marcá todas las correctas' : pregunta.tipo === 'ordenar' ? 'Ordenalos de arriba hacia abajo' : null;
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

/** Ordenar pasos: se arrastran (o se mueven con las flechas) y se manda el orden. */
function Ordenar({ pregunta, bloqueado, onResponder }: PropsTipo) {
  const [orden, setOrden] = useState<OpcionEnJuego[]>(pregunta.opciones);
  const clave = pregunta.opciones.map((o) => o.id).join(',');
  useEffect(() => setOrden(pregunta.opciones), [pregunta.id, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const mover = (i: number, d: -1 | 1) =>
    setOrden((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  return (
    <>
      <Reorder.Group
        axis="y"
        values={orden}
        onReorder={(n) => !bloqueado && setOrden(n)}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1"
      >
        {orden.map((o, i) => (
          <Paso key={o.id} opcion={o} posicion={i} total={orden.length} bloqueado={bloqueado} onMover={(d) => mover(i, d)} />
        ))}
      </Reorder.Group>
      <Button size="lg" className="h-14 flex-none text-lg" disabled={bloqueado} onClick={() => onResponder?.(orden.map((o) => o.id))}>
        <Send data-icon="inline-start" />
        Mandar este orden
      </Button>
    </>
  );
}

function Paso({ opcion, posicion, total, bloqueado, onMover }: { opcion: OpcionEnJuego; posicion: number; total: number; bloqueado: boolean; onMover: (d: -1 | 1) => void }) {
  const arrastre = useDragControls();
  return (
    <Reorder.Item
      value={opcion}
      dragListener={false}
      dragControls={arrastre}
      className="flex min-h-14 flex-none items-center gap-2 rounded-2xl bg-card py-2 pr-2 pl-1 text-lg font-bold shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 select-none"
      whileDrag={{ scale: 1.03, boxShadow: 'var(--pd-sombra-flotante)' }}
    >
      <span
        aria-hidden
        onPointerDown={(e) => !bloqueado && arrastre.start(e)}
        className="grid h-10 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical />
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-base text-white tabular-nums">{posicion + 1}</span>
      <span className="min-w-0 flex-1 leading-tight">{opcion.texto}</span>
      <Button variant="ghost" size="icon" aria-label={`Subir "${opcion.texto}"`} disabled={bloqueado || posicion === 0} onClick={() => onMover(-1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Bajar "${opcion.texto}"`} disabled={bloqueado || posicion === total - 1} onClick={() => onMover(1)}>
        <ArrowDown />
      </Button>
    </Reorder.Item>
  );
}

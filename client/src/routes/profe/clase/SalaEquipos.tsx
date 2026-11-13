import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownToLine, Minus, Plus, Scale, Shuffle } from 'lucide-react';
import { equipo, MAX_EQUIPOS, MIN_EQUIPOS, type AccionJuego, type EstadoJuego } from '@aula/shared';
import { ChipEquipo } from '@/components/pd/Equipo';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { MOVIMIENTO } from '@/lib/movimiento';
import { cn } from '@/lib/utils';

interface Props {
  estado: EstadoJuego;
  accion: (a: AccionJuego) => Promise<boolean>;
  ocupado: boolean;
}

/**
 * Sala de espera por equipos: quién quedó en cada uno, y cómo acomodarlos. Con el mouse se arrastra a
 * alguien hasta otro equipo; con el dedo (o el teclado) se lo toca y después se elige el equipo. También se
 * puede cambiar la cantidad de equipos, emparejarlos o mezclarlos de nuevo.
 */
export function SalaEquipos({ estado: e, accion, ocupado }: Props) {
  const cantidad = e.equipos?.length ?? 0;
  /** El alumno tocado, que espera que le elijan equipo. */
  const [elegido, setElegido] = useState<number | null>(null);
  /** El equipo sobre el que se está arrastrando a alguien. */
  const [sobre, setSobre] = useState<number | null>(null);
  const alumnoElegido = e.ranking.find((r) => r.alumnoId === elegido) ?? null;

  // Si el elegido se fue del quiz, o se toca Escape, se suelta.
  useEffect(() => {
    if (elegido !== null && !alumnoElegido) setElegido(null);
  }, [elegido, alumnoElegido]);
  useEffect(() => {
    if (elegido === null) return;
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && setElegido(null);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [elegido]);

  // Parejos: entre los conectados (los que de verdad juegan), ningún equipo le lleva más de uno a otro.
  const conectados = Array.from({ length: cantidad }, (_, i) => e.ranking.filter((r) => r.equipo === i && r.conectado).length);
  const desparejos = cantidad > 0 && Math.max(...conectados) - Math.min(...conectados) > 1;

  const mover = (alumnoId: number, destino: number) => {
    setElegido(null);
    setSobre(null);
    if (e.ranking.find((r) => r.alumnoId === alumnoId)?.equipo === destino) return;
    void accion({ tipo: 'moverEquipo', alumnoId, equipo: destino });
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-pd-celeste-claro/60 p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="min-w-48 flex-1 font-semibold">
          {e.ranking.length === 0
            ? 'Esperando que entren los alumnos…'
            : alumnoElegido
              ? `¿A qué equipo va ${alumnoElegido.nombre}?`
              : 'Se reparten solos a medida que entran. Arrastrá a alguien a otro equipo, o tocalo y elegí a cuál va.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Cantidad de equipos: al cambiarla, se reacomodan solos. */}
          <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-[var(--pd-sombra-tarjeta)]" role="group" aria-label="Cantidad de equipos">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Un equipo menos"
              disabled={ocupado || cantidad <= MIN_EQUIPOS}
              onClick={() => void accion({ tipo: 'cantidadEquipos', cantidad: cantidad - 1 })}
            >
              <Minus />
            </Button>
            <span className="min-w-20 text-center text-sm font-bold tabular-nums" aria-live="polite">
              {cantidad} equipos
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Un equipo más"
              disabled={ocupado || cantidad >= MAX_EQUIPOS}
              onClick={() => void accion({ tipo: 'cantidadEquipos', cantidad: cantidad + 1 })}
            >
              <Plus />
            </Button>
          </div>
          <Button
            variant={desparejos ? 'default' : 'outline'}
            size="sm"
            className={cn(desparejos && !ocupado && 'latido')}
            disabled={ocupado || !desparejos}
            title={desparejos ? 'Pasa a los que haga falta para que queden parejos, sin desarmar el resto' : 'Ya están parejos'}
            onClick={() => void accion({ tipo: 'emparejarEquipos' })}
          >
            <Scale data-icon="inline-start" />
            Emparejar
          </Button>
          <Button variant="outline" size="sm" disabled={ocupado || e.ranking.length < 2} onClick={() => void accion({ tipo: 'mezclarEquipos' })}>
            <Shuffle data-icon="inline-start" />
            Mezclar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cantidad }, (_, i) => {
          const miembros = e.ranking.filter((r) => r.equipo === i);
          const sinConexion = miembros.length - conectados[i]!;
          const destino = alumnoElegido !== null && alumnoElegido.equipo !== i;
          return (
            <div
              key={i}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                if (sobre !== i) setSobre(i);
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSobre((s) => (s === i ? null : s));
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                const id = Number(ev.dataTransfer.getData('text/plain'));
                if (id) mover(id, i);
              }}
              className={cn(
                'flex min-h-28 flex-col gap-2 rounded-2xl bg-card p-3 transition-[box-shadow,transform] duration-200',
                sobre === i && 'scale-[1.02] ring-3 ring-pd-celeste',
              )}
              style={{ boxShadow: sobre === i ? undefined : `inset 0 4px 0 ${equipo(i).color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <ChipEquipo indice={i} className="text-sm" />
                <span className="text-sm text-muted-foreground tabular-nums">
                  {conectados[i]}
                  {sinConexion > 0 && ` (+${sinConexion} sin conexión)`}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {miembros.map((r) => (
                  // Con el mismo layoutId, al cambiar de equipo la pastilla viaja de una tarjeta a la otra.
                  <motion.li key={r.alumnoId} layout layoutId={`sala-equipo-${r.alumnoId}`} transition={MOVIMIENTO.suave}>
                    <button
                      type="button"
                      disabled={ocupado}
                      draggable={!ocupado}
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData('text/plain', String(r.alumnoId));
                        ev.dataTransfer.effectAllowed = 'move';
                        setElegido(null);
                      }}
                      onDragEnd={() => setSobre(null)}
                      onClick={() => setElegido(elegido === r.alumnoId ? null : r.alumnoId)}
                      aria-pressed={elegido === r.alumnoId}
                      aria-label={`${r.nombre}, de los ${equipo(i).nombre}. Tocá para pasarlo a otro equipo`}
                      className={cn(
                        'flex cursor-grab items-center gap-1.5 rounded-full bg-muted py-0.5 pr-3 pl-0.5 text-sm font-medium outline-none transition-[background-color,box-shadow,transform] hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
                        !r.conectado && 'opacity-50',
                        elegido === r.alumnoId && 'scale-105 bg-secondary ring-2 ring-pd-celeste',
                      )}
                    >
                      <PinAvatar avatar={r.avatar} tamano={24} />
                      {r.nombre}
                    </button>
                  </motion.li>
                ))}
              </ul>
              {miembros.length === 0 && !destino && <p className="text-sm text-muted-foreground">Todavía sin nadie. Arrastrá a alguien acá.</p>}
              {destino && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto w-full border-dashed"
                  disabled={ocupado}
                  onClick={() => mover(alumnoElegido.alumnoId, i)}
                >
                  <ArrowDownToLine data-icon="inline-start" />
                  Pasar acá
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

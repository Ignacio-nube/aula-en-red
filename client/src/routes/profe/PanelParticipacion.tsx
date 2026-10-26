import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { Bell, BellOff, Check, ChevronDown, MessageCircleQuestion, MonitorOff, MonitorPlay, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionPreguntas, ConteoSenales, ManoLevantada, PreguntaAnonima, TipoSenal } from '@aula/shared';
import { Pin, PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { emitirConAck } from '@/lib/juego';
import { activarAvisoManos, avisoManosActivado, sonidos } from '@/lib/sonidos';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';

function espera(desde: number, ahora: number): string {
  const min = Math.floor((ahora - desde) / 60_000);
  return min < 1 ? 'recién' : `hace ${min} min`;
}

/** Re-renderiza cada tanto para que "hace X minutos" no quede viejo. */
function useAhora(cadaMs: number, activo: boolean): number {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(id);
  }, [cadaMs, activo]);
  return ahora;
}

/** Avisa (sonido suave + saltito) cuando sube alguno de los contadores. */
function useAviso(valores: number[]) {
  const saltito = useAnimationControls();
  const previos = useRef<number[] | null>(null);
  const clave = valores.join(',');
  useEffect(() => {
    const antes = previos.current;
    previos.current = valores;
    // Lo que ya había al abrir el panel no cuenta como novedad.
    if (antes === null || !valores.some((v, i) => v > (antes[i] ?? 0))) return;
    sonidos.mano();
    void saltito.start({ y: [0, -10, 0], scale: [1, 1.04, 1], transition: { duration: 0.45, ease: 'easeOut' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, saltito]);
  return saltito;
}

interface Props {
  manos: ManoLevantada[];
  socket: SocketAula | null;
  senales: ConteoSenales;
  preguntas: PreguntaAnonima[];
  destacada: string | null;
}

/**
 * Participación de la clase, flotando abajo a la izquierda en cualquier pestaña del panel: manos
 * levantadas (en orden de llegada), avisos anónimos ("No entendí", "Más despacio") y preguntas
 * anónimas. Cerrado es una pastilla con los contadores y quién sigue en la fila, para no tapar
 * nada; se despliega al tocarla.
 */
export function PanelParticipacion({ manos, socket, senales, preguntas, destacada }: Props) {
  const [abierto, setAbierto] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState(avisoManosActivado);
  const [verPreguntas, setVerPreguntas] = useState(false);
  const saltito = useAviso([manos.length, senales.noEntendi, senales.despacio, preguntas.length]);
  const hayAlgo = manos.length > 0 || senales.noEntendi > 0 || senales.despacio > 0 || preguntas.length > 0 || destacada !== null;

  // Desplegado funciona como un menú: se cierra al tocar afuera o con Escape, así nunca tapa nada.
  useEffect(() => {
    if (!abierto) return;
    // Mientras haya un diálogo en pantalla (aunque se esté cerrando), los toques y el Escape son
    // de él: el Escape que cierra el diálogo de preguntas no tiene que plegar también el panel.
    const hayDialogo = () => verPreguntas || document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
    const afuera = (e: PointerEvent) => {
      if (hayDialogo() || panel.current?.contains(e.target as Node)) return;
      setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !hayDialogo() && setAbierto(false);
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, verPreguntas]);
  const alternar = () => setAbierto(!abierto);

  const accionPreguntas = async (a: AccionPreguntas) => {
    const r = await emitirConAck(socket, 'preguntas:accion', a);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 max-lg:bottom-[calc(4.75rem+var(--extra-abajo,0px)+env(safe-area-inset-bottom))] max-lg:left-3">
      <AnimatePresence>
        {hayAlgo && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto"
            ref={panel}
          >
            <motion.section
              layout
              animate={saltito}
              aria-label="Participación"
              transition={{ layout: { type: 'spring', stiffness: 500, damping: 40 } }}
              className="overflow-hidden rounded-[1.6rem] bg-card shadow-[var(--pd-sombra-flotante)] ring-1 ring-foreground/10"
            >
              <motion.header layout="position" className="flex items-center gap-1 p-1.5">
                <button
                  type="button"
                  onClick={alternar}
                  aria-expanded={abierto}
                  className="flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {manos.length > 0 && (
                    <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-pd-celeste-claro py-0.5 pr-2.5 pl-1">
                      <Pin tamano={20}>
                        <span aria-hidden>✋</span>
                      </Pin>
                      <span className="max-w-28 truncate font-semibold" aria-label={`Sigue: ${manos[0]!.nombre}`}>
                        {manos[0]!.nombre}
                      </span>
                      {manos.length > 1 && <span className="font-bold text-muted-foreground tabular-nums">+{manos.length - 1}</span>}
                    </span>
                  )}
                  <Contador emoji="🤔" n={senales.noEntendi} etiqueta="no entendieron" />
                  <Contador emoji="🐢" n={senales.despacio} etiqueta="piden más despacio" />
                  {preguntas.length > 0 && (
                    <span className="flex items-center gap-1 px-1 font-bold tabular-nums" aria-label={`${preguntas.length} preguntas anónimas`}>
                      <MessageCircleQuestion className="size-4 text-pd-celeste-oscuro" />
                      {preguntas.length}
                    </span>
                  )}
                  {destacada && <MonitorPlay className="size-4 text-pd-celeste-oscuro" aria-label="Hay una pregunta en la pantalla" />}
                  <ChevronDown className={cn('ml-1 size-4 shrink-0 text-muted-foreground transition-transform', !abierto && 'rotate-180')} />
                </button>
                {abierto && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto"
                        aria-label={aviso ? 'Silenciar el aviso' : 'Activar el aviso con sonido'}
                        aria-pressed={aviso}
                        onClick={() => {
                          activarAvisoManos(!aviso);
                          setAviso(!aviso);
                        }}
                      >
                        {aviso ? <Bell /> : <BellOff />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{aviso ? 'Suena un aviso suave con cada novedad' : 'Aviso con sonido apagado'}</TooltipContent>
                  </Tooltip>
                )}
              </motion.header>

              {abierto && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex max-h-[min(55vh,26rem)] w-72 flex-col gap-1 overflow-y-auto px-1.5 pb-1.5"
                >
                  <Senales senales={senales} socket={socket} />
                  {(preguntas.length > 0 || destacada) && (
                    <div className="flex flex-col gap-1">
                      {preguntas.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setVerPreguntas(true)}
                          className="flex items-center gap-2 rounded-xl bg-muted/60 py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <MessageCircleQuestion className="size-5 text-pd-celeste-oscuro" />
                          <span className="min-w-0 flex-1">
                            <strong className="tabular-nums">{preguntas.length}</strong> {preguntas.length === 1 ? 'pregunta anónima' : 'preguntas anónimas'}
                          </span>
                          <span className="text-xs font-semibold text-pd-celeste-oscuro">Ver</span>
                        </button>
                      )}
                      {destacada && (
                        <div className="flex items-center gap-2 rounded-xl bg-pd-celeste-claro py-1 pr-1 pl-2 text-xs">
                          <MonitorPlay className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">En la pantalla: “{destacada}”</span>
                          <Button variant="ghost" size="xs" onClick={() => void accionPreguntas({ tipo: 'quitarDestacada' })}>
                            Quitar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <Manos manos={manos} socket={socket} />
                </motion.div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <DialogoPreguntas abierto={verPreguntas} onCerrar={() => setVerPreguntas(false)} preguntas={preguntas} destacada={destacada} onAccion={accionPreguntas} />
    </div>
  );
}

function Contador({ emoji, n, etiqueta }: { emoji: string; n: number; etiqueta: string }) {
  if (n === 0) return null;
  return (
    <span className="flex items-center gap-0.5 px-1 font-bold tabular-nums" aria-label={`${n} ${etiqueta}`}>
      <span aria-hidden>{emoji}</span>
      <motion.span key={n} initial={{ scale: 1.7 }} animate={{ scale: 1 }}>
        {n}
      </motion.span>
    </span>
  );
}

function Senales({ senales, socket }: { senales: ConteoSenales; socket: SocketAula | null }) {
  const limpiar = async (tipo: TipoSenal) => {
    const r = await emitirConAck(socket, 'senales:limpiar', tipo);
    if (!r.ok) toast.error(r.error);
  };
  const filas: { tipo: TipoSenal; emoji: string; texto: string; n: number }[] = [
    { tipo: 'noEntendi', emoji: '🤔', texto: senales.noEntendi === 1 ? 'no entendió' : 'no entendieron', n: senales.noEntendi },
    { tipo: 'despacio', emoji: '🐢', texto: senales.despacio === 1 ? 'pide más despacio' : 'piden más despacio', n: senales.despacio },
  ];
  const visibles = filas.filter((f) => f.n > 0);
  if (visibles.length === 0) return null;
  return (
    <div aria-label="Avisos anónimos" className="flex flex-col gap-1">
      {visibles.map((f) => (
        <div key={f.tipo} className="flex items-center gap-2 rounded-xl bg-pd-resp-c/15 py-1 pr-1 pl-2">
          <span aria-hidden className="text-lg">
            {f.emoji}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <strong className="tabular-nums">{f.n}</strong> {f.texto}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="xs" onClick={() => void limpiar(f.tipo)}>
                Listo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ya lo atendí: ponerlo en cero (igual se borran solos a los 3 minutos)</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

function DialogoPreguntas({
  abierto,
  onCerrar,
  preguntas,
  destacada,
  onAccion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  preguntas: PreguntaAnonima[];
  destacada: string | null;
  onAccion: (a: AccionPreguntas) => Promise<void>;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preguntas anónimas</DialogTitle>
          <DialogDescription>Nadie sabe quién las mandó, ni vos. Podés mostrar una en la pantalla grande para responderla para todos.</DialogDescription>
        </DialogHeader>
        {preguntas.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No quedan preguntas.</p>
        ) : (
          <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {preguntas.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  exit={{ opacity: 0, x: 30 }}
                  className={cn('flex flex-col gap-2 rounded-2xl bg-muted/60 p-3', destacada === p.texto && 'ring-2 ring-pd-celeste')}
                >
                  <p className="text-base font-medium break-words">{p.texto}</p>
                  <div className="flex flex-wrap gap-2">
                    {destacada === p.texto ? (
                      <Button size="sm" variant="secondary" onClick={() => void onAccion({ tipo: 'quitarDestacada' })}>
                        <MonitorOff data-icon="inline-start" />
                        Sacar de la pantalla
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void onAccion({ tipo: 'destacar', id: p.id })}>
                        <MonitorPlay data-icon="inline-start" />
                        Mostrar en la pantalla
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => void onAccion({ tipo: 'borrar', id: p.id })}>
                      <Check data-icon="inline-start" />
                      Respondida
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {preguntas.length > 1 && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => void onAccion({ tipo: 'borrarTodas' })}>
              Borrar todas
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Fila de manos levantadas, en orden de llegada. */
function Manos({ manos, socket }: { manos: ManoLevantada[]; socket: SocketAula | null }) {
  const ahora = useAhora(20_000, manos.length > 0);
  const bajar = async (alumnoId: number | null) => {
    const r = await emitirConAck(socket, 'manos:bajar', alumnoId);
    if (!r.ok) toast.error(r.error);
  };
  if (manos.length === 0) return null;
  return (
    <div aria-label="Manos levantadas" className="flex flex-col">
      <p className="px-2 pt-1 pb-0.5 text-xs font-semibold text-muted-foreground">
        {manos.length === 1 ? '1 mano levantada' : `${manos.length} manos levantadas`}
      </p>
      <ol className="flex flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {manos.map((m, i) => (
            <motion.li
              key={m.alumnoId}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              className={cn('flex items-center gap-2 rounded-xl py-0.5 pr-0.5 pl-1.5', i === 0 && 'bg-pd-celeste-claro')}
            >
              <span className="w-4 text-center text-xs font-bold text-muted-foreground tabular-nums" aria-label={`Puesto ${i + 1}`}>
                {i + 1}
              </span>
              <PinAvatar avatar={m.avatar} tamano={22} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="truncate text-sm font-semibold">{m.nombre}</span>
                <span className="flex flex-none items-center gap-1 text-xs text-muted-foreground">
                  {!m.conectado && <WifiOff className="size-3" aria-label="Desconectado" />}
                  {espera(m.desde, ahora)}
                </span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Atendida: bajar la mano de ${m.nombre}`} onClick={() => void bajar(m.alumnoId)}>
                    <Check />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atendida</TooltipContent>
              </Tooltip>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {manos.length > 1 && (
        <Button variant="ghost" size="xs" className="mt-0.5 self-end" onClick={() => void bajar(null)}>
          Bajar todas
        </Button>
      )}
    </div>
  );
}

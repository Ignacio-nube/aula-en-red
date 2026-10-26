import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, FastForward, MonitorPlay, Pause, Play, Plus, Square } from 'lucide-react';
import { toast } from 'sonner';
import { NOMBRE_TIPO, type AccionJuego, type EstadoJuego, type FaseJuego, type ModoRanking } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { estiloRespuesta, FormaRespuesta } from '@/components/pd/Respuesta';
import { Temporizador } from '@/components/pd/Temporizador';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatoPuntos, ordinal, urlImagen, useRestante } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';

const NOMBRE_FASE: Record<FaseJuego, string> = {
  lobby: 'Sala de espera',
  cuenta: 'Cuenta regresiva',
  pregunta: 'Respondiendo',
  resultado: 'Resultado de la pregunta',
  ranking: 'Ranking',
  podio: 'Podio final',
};

function textoSiguiente(e: EstadoJuego): string {
  switch (e.fase) {
    case 'lobby':
      return 'Empezar el quiz';
    case 'cuenta':
      return 'Mostrar la pregunta ya';
    case 'pregunta':
      return 'Cerrar la pregunta';
    case 'resultado':
      return 'Ver el ranking';
    case 'ranking':
      return e.indice + 1 >= e.total ? 'Ver el podio' : 'Siguiente pregunta';
    case 'podio':
      return 'Volver al panel';
  }
}

export function ControlJuego({ estado: e, recibido }: { estado: EstadoJuego; recibido: number }) {
  const { controlar, irA } = useProfe();
  const restante = useRestante({ estado: e, recibido });
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const accion = useCallback(
    async (a: AccionJuego) => {
      setOcupado(true);
      const r = await controlar(a);
      setOcupado(false);
      if (!r.ok) toast.error(r.error);
      return r.ok;
    },
    [controlar],
  );

  const siguiente = useCallback(() => accion(e.fase === 'podio' ? { tipo: 'cerrar' } : { tipo: 'siguiente' }), [accion, e.fase]);

  // Flecha derecha, Av Pág o barra espaciadora: también funcionan con un presentador inalámbrico.
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="dialog"], [contenteditable]')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') {
        ev.preventDefault();
        if (!ocupado) void siguiente();
      }
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [siguiente, ocupado]);

  const terminar = () =>
    setConfirmacion({
      titulo: '¿Terminar el quiz ahora?',
      descripcion:
        e.fase === 'pregunta'
          ? 'La pregunta en curso se cierra con las respuestas que haya y se pasa directo al podio.'
          : 'Se pasa directo al podio. Las preguntas que faltan quedan sin jugar.',
      accion: 'Terminar y ver el podio',
      destructiva: true,
      onConfirmar: () => void accion({ tipo: 'terminar' }),
    });

  const p = e.pregunta;
  const enPregunta = e.fase === 'pregunta';
  const respondieron = new Set(e.quienesRespondieron ?? []);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant={enPregunta ? 'default' : 'secondary'}>{NOMBRE_FASE[e.fase]}</Badge>
            Comisión {e.comisionNombre}
            {e.indice >= 0 && e.fase !== 'lobby' && `, pregunta ${e.indice + 1} de ${e.total}`}
          </CardDescription>
          <CardTitle className="text-2xl">{e.quizTitulo}</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
              <MonitorPlay data-icon="inline-start" />
              Pantalla grande
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {e.fase === 'lobby' ? (
            <div className="flex flex-col gap-3 rounded-3xl bg-pd-celeste-claro/60 p-5">
              <p className="font-semibold">
                {e.ranking.length === 0
                  ? 'Esperando que entren los alumnos…'
                  : `${e.ranking.length === 1 ? 'Entró 1 alumno' : `Entraron ${e.ranking.length} alumnos`}. Cuando estén todos, empezá.`}
              </p>
              <ul className="flex flex-wrap gap-3">
                {e.ranking.map((r) => (
                  <li key={r.alumnoId} className={cn('flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1', !r.conectado && 'opacity-50')}>
                    <PinAvatar avatar={r.avatar} tamano={30} />
                    <span className="text-sm font-medium">{r.nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : e.fase === 'podio' ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-pd-celeste-claro/60 p-6 text-center">
              <span className="text-5xl" aria-hidden>
                🏆
              </span>
              <p className="text-xl font-bold">
                {e.ranking[0] ? `Ganó ${e.ranking[0].nombre} con ${formatoPuntos(e.ranking[0].puntos)} puntos` : 'Terminó el quiz'}
              </p>
              <p className="text-muted-foreground">El podio se está mostrando en la pantalla grande. Los resultados quedaron guardados.</p>
              <Button variant="outline" className="mt-2" onClick={() => irA('resultados')}>
                Ver resultados
              </Button>
            </div>
          ) : p ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-xl leading-snug font-bold">{p.texto}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.multiplicador === 2 && <Badge>Puntos dobles</Badge>}
                    {p.multiplicador === 0 && <Badge variant="secondary">Sin puntos</Badge>}
                    {(p.tipo === 'varias' || p.tipo === 'ordenar') && <Badge variant="outline">{NOMBRE_TIPO[p.tipo]}</Badge>}
                    {e.fase === 'cuenta' && <Badge variant="secondary">Los alumnos todavía no la ven</Badge>}
                    {e.correctas !== null && e.respondieron > 0 && (
                      <Badge variant="secondary">{e.correctas === 1 ? '1 respuesta correcta' : `${e.correctas} respuestas correctas`}</Badge>
                    )}
                  </div>
                </div>
                {p.imagen && <img src={urlImagen(p.imagen)} alt="" className="h-20 rounded-xl object-cover" />}
                {enPregunta && <Temporizador restanteMs={restante} totalMs={e.tiempoTotalMs} pausado={e.pausado} tamano={84} />}
              </div>
              {p.tipo === 'ordenar' ? (
                <ol className="flex flex-col gap-2">
                  {(p.ordenCorrecto ?? p.opciones.map((o) => o.id)).map((id, i) => {
                    const k = p.opciones.findIndex((o) => o.id === id);
                    const cant = e.distribucion?.[k] ?? 0;
                    return (
                      <li key={id} className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-muted/60 px-3 py-2.5">
                        <span
                          className="absolute inset-y-0 left-0 bg-pd-celeste/20 transition-[width] duration-500"
                          style={{ width: `${(cant / Math.max(1, e.respondieron)) * 100}%` }}
                          aria-hidden
                        />
                        <span className="relative grid size-6 shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-xs font-bold text-white">{i + 1}</span>
                        <span className="relative min-w-0 flex-1 truncate font-medium">{p.opciones[k]?.texto}</span>
                        <span className="relative text-sm text-muted-foreground tabular-nums">{cant} en su lugar</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
              <ul className="flex flex-col gap-2">
                {p.opciones.map((o, i) => {
                  const est = estiloRespuesta(p.tipo, i);
                  const cant = e.distribucion?.[i] ?? 0;
                  const max = Math.max(1, e.respondieron);
                  return (
                    <li key={o.id} className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-muted/60 px-3 py-2.5">
                      <span
                        className="absolute inset-y-0 left-0 transition-[width] duration-500"
                        style={{ width: `${(cant / max) * 100}%`, backgroundColor: `color-mix(in oklch, ${est.fondo} 22%, transparent)` }}
                        aria-hidden
                      />
                      <FormaRespuesta forma={est.forma} color={est.fondo} className="relative size-5 shrink-0" />
                      <span className="relative min-w-0 flex-1 truncate font-medium">{o.texto}</span>
                      {o.correcta && (
                        <span className="relative flex items-center gap-1 text-sm font-semibold text-bien-texto">
                          <Check className="size-4" strokeWidth={3} />
                          Correcta
                        </span>
                      )}
                      <span className="relative w-8 text-right font-bold tabular-nums">{cant}</span>
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          ) : null}

          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button size="lg" onClick={() => void siguiente()} disabled={ocupado}>
              {e.fase === 'lobby' ? <Play data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
              {textoSiguiente(e)}
            </Button>
            {e.fase !== 'podio' && (
              <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex">
                o <Kbd>→</Kbd>
              </span>
            )}
            {enPregunta &&
              (e.pausado ? (
                <Button variant="secondary" onClick={() => void accion({ tipo: 'reanudar' })}>
                  <Play data-icon="inline-start" />
                  Reanudar
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void accion({ tipo: 'pausar' })}>
                  <Pause data-icon="inline-start" />
                  Pausar
                </Button>
              ))}
            {enPregunta && (
              <Button variant="secondary" onClick={() => void accion({ tipo: 'extender' })}>
                <Plus data-icon="inline-start" />
                10 segundos
              </Button>
            )}
            {(enPregunta || e.fase === 'cuenta') && (
              <Button variant="ghost" onClick={() => void accion({ tipo: 'saltar' })}>
                <FastForward data-icon="inline-start" />
                Saltar pregunta
              </Button>
            )}
            {e.fase !== 'podio' && (
              <Button variant="destructive" className="ml-auto" onClick={terminar}>
                <Square data-icon="inline-start" />
                Terminar quiz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{enPregunta ? `Respondieron ${e.respondieron} de ${e.conectados}` : 'Ranking'}</CardTitle>
          <CardDescription>En la pantalla grande se muestra:</CardDescription>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={e.modoRanking}
            onValueChange={(v) => v && void accion({ tipo: 'modoRanking', modo: v as ModoRanking })}
            className="mt-1 w-full"
          >
            <ToggleGroupItem value="todos" className="flex-1">
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem value="top3" className="flex-1">
              Solo el top 3
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {e.ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay participantes.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {e.ranking.map((r) => (
                <li key={r.alumnoId} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', !r.conectado && 'opacity-50')}>
                  <span className="w-7 text-right text-sm font-bold text-muted-foreground tabular-nums">{ordinal(r.puesto)}</span>
                  <PinAvatar avatar={r.avatar} tamano={26} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.nombre}
                    {!r.conectado && <span className="text-muted-foreground"> (desconectado)</span>}
                  </span>
                  {enPregunta ? (
                    respondieron.has(r.alumnoId) ? (
                      <Check className="size-4 text-bien-texto" strokeWidth={3} aria-label="Respondió" />
                    ) : (
                      <span className="size-2 rounded-full bg-muted-foreground/30" aria-label="Todavía no respondió" />
                    )
                  ) : (
                    <span className="text-sm font-semibold tabular-nums">{formatoPuntos(r.puntos)}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

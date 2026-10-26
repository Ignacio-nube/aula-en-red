import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Trash2, Vote } from 'lucide-react';
import { toast } from 'sonner';
import {
  fechaSqlite,
  LETRAS,
  type AlumnoPublico,
  type Comision,
  type EncuestaGuardada,
  type HistorialAlumno,
  type ResultadoPregunta,
  type SesionDetalle,
  type SesionResumen,
} from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { mensajeDe } from '@/lib/api';
import { descargar } from '@/lib/descarga';
import { formatoPuntos, ordinal } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';

const fecha = (s: string) =>
  fechaSqlite(s).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Color según qué tan bien les fue: para detectar de un vistazo qué temas no se entendieron. */
function colorPorcentaje(p: number | null): string {
  if (p === null) return 'var(--muted-foreground)';
  if (p < 50) return 'var(--pd-resp-b)';
  if (p < 75) return 'var(--pd-resp-c)';
  return 'var(--pd-resp-d)';
}

/** El mismo color, en un tono que se lee como texto sobre la tarjeta. */
function colorTextoPorcentaje(p: number | null): string {
  if (p === null) return 'var(--muted-foreground)';
  if (p < 50) return 'var(--pd-mal-texto)';
  if (p < 75) return 'var(--pd-medio-texto)';
  return 'var(--pd-bien-texto)';
}

async function bajar(ruta: string) {
  try {
    await descargar(ruta);
  } catch (e) {
    toast.error(mensajeDe(e));
  }
}

export function Resultados() {
  const [vista, setVista] = useState<'sesiones' | 'alumnos' | 'encuestas'>('sesiones');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Resultados</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" value={vista} onValueChange={(v) => v && setVista(v as typeof vista)}>
            <ToggleGroupItem value="sesiones">Por quiz</ToggleGroupItem>
            <ToggleGroupItem value="alumnos">Por alumno</ToggleGroupItem>
            <ToggleGroupItem value="encuestas">Encuestas</ToggleGroupItem>
          </ToggleGroup>
          {vista !== 'encuestas' && (
            <Button variant="outline" size="sm" onClick={() => void bajar('/resultados/csv')}>
              <Download data-icon="inline-start" />
              Todo en CSV
            </Button>
          )}
        </div>
      </div>
      {vista === 'sesiones' ? <PorSesion /> : vista === 'alumnos' ? <PorAlumno /> : <PorEncuesta />}
    </div>
  );
}

// --- por sesión ---------------------------------------------------------------------

function PorSesion() {
  const { pedir } = useProfe();
  const [sesiones, setSesiones] = useState<SesionResumen[] | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<SesionDetalle | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  const cargar = useCallback(() => {
    pedir<SesionResumen[]>('/resultados/sesiones')
      .then((s) => {
        setSesiones(s);
        setElegida((id) => (s.some((x) => x.id === id) ? id : (s[0]?.id ?? null)));
      })
      .catch((e) => toast.error(mensajeDe(e)));
  }, [pedir]);
  useEffect(cargar, [cargar]);

  useEffect(() => {
    if (elegida === null) return setDetalle(null);
    pedir<SesionDetalle>(`/resultados/sesiones/${elegida}`)
      .then(setDetalle)
      .catch((e) => toast.error(mensajeDe(e)));
  }, [elegida, pedir]);

  const borrar = (s: SesionDetalle) =>
    setConfirmacion({
      titulo: '¿Borrar estos resultados?',
      descripcion: `Se borra del historial "${s.quizTitulo}" del ${fecha(s.iniciadaEn)}, con las respuestas de cada alumno. No se puede deshacer.`,
      accion: 'Borrar resultados',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(`/resultados/sesiones/${s.id}`, { method: 'DELETE' });
          cargar();
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  if (sesiones === null) return <Skeleton className="h-96 rounded-3xl" />;
  if (sesiones.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>Todavía no se jugó ningún quiz</EmptyTitle>
            <EmptyDescription>Cuando termines uno desde Clase en vivo, acá vas a ver el ranking y qué preguntas costaron más.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="gap-2">
        <CardContent className="px-3">
          <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
            {sesiones.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={s.id === elegida || undefined}
                  onClick={() => setElegida(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                    s.id === elegida && 'bg-secondary hover:bg-secondary',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.quizTitulo}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.comisionNombre}, {fecha(s.iniciadaEn)}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: colorTextoPorcentaje(s.porcentajeAciertos) }}>
                    {s.porcentajeAciertos === null ? 'Sin datos' : `${s.porcentajeAciertos}%`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {detalle ? <DetalleSesion detalle={detalle} onBorrar={() => borrar(detalle)} /> : <Skeleton className="h-96 rounded-3xl" />}
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

function DetalleSesion({ detalle: d, onBorrar }: { detalle: SesionDetalle; onBorrar: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{d.quizTitulo}</CardTitle>
          <CardDescription>
            Comisión {d.comisionNombre}, {fecha(d.iniciadaEn)} h. {d.participantes === 1 ? '1 participante' : `${d.participantes} participantes`},{' '}
            {d.preguntasJugadas} de {d.total} preguntas jugadas.
            {!d.finalizada && ' Quedó sin terminar.'}
          </CardDescription>
          <CardAction className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => void bajar(`/resultados/sesiones/${d.id}/csv`)}>
              <Download data-icon="inline-start" />
              CSV
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Borrar estos resultados" onClick={onBorrar}>
              <Trash2 />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">Ranking final</h3>
            {d.ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie participó.</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {d.ranking.map((r) => (
                  <li key={r.alumnoId} className="flex items-center gap-2 rounded-xl px-2 py-1.5 odd:bg-muted/50">
                    <span className="w-7 text-right text-sm font-bold text-muted-foreground tabular-nums">{ordinal(r.puesto)}</span>
                    <PinAvatar avatar={r.avatar} tamano={26} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.nombre}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {r.aciertos}/{d.preguntasJugadas}
                    </span>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums">{formatoPuntos(r.puntos)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">Aciertos por pregunta</h3>
            <ol className="flex flex-col gap-3">
              {d.preguntas.map((p) => (
                <FilaPregunta key={p.id} p={p} />
              ))}
            </ol>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function FilaPregunta({ p }: { p: ResultadoPregunta }) {
  const [abierta, setAbierta] = useState(false);
  const jugada = p.estado === 'jugada';
  return (
    <li className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => jugada && setAbierta(!abierta)}
        aria-expanded={jugada ? abierta : undefined}
        className="flex items-start gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="w-6 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">{p.indice + 1}</span>
        <span className="min-w-0 flex-1 text-sm font-medium">{p.texto}</span>
        {jugada ? (
          <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: colorTextoPorcentaje(p.porcentaje) }}>
            {p.porcentaje}%
          </span>
        ) : (
          <Badge variant="secondary">{p.estado === 'salteada' ? 'Salteada' : 'No se jugó'}</Badge>
        )}
      </button>
      {jugada && (
        <div className="ml-8 flex flex-col gap-1.5">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.correctas} de ${p.total} acertaron`}>
            <div className="h-full rounded-full" style={{ width: `${p.porcentaje}%`, backgroundColor: colorPorcentaje(p.porcentaje) }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {p.correctas} de {p.total} acertaron{p.sinResponder > 0 && `, ${p.sinResponder} no llegaron a responder`}.
          </p>
          {abierta && (
            <ul className="flex flex-col gap-1 rounded-xl bg-muted/50 p-2 text-sm">
              {p.tipo === 'ordenar' && <li className="text-xs text-muted-foreground">En el orden correcto, con cuántos pusieron cada paso en su lugar:</li>}
              {p.opciones.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2">
                  <span className="w-5 font-bold text-muted-foreground">{p.tipo === 'vf' ? '' : p.tipo === 'ordenar' ? `${i + 1}.` : LETRAS[i]}</span>
                  <span className={cn('min-w-0 flex-1 truncate', o.esCorrecta && p.tipo !== 'ordenar' && 'font-semibold')}>
                    {o.texto}
                    {o.esCorrecta && p.tipo !== 'ordenar' && ' (correcta)'}
                  </span>
                  <span className="tabular-nums">{o.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// --- encuestas ----------------------------------------------------------------------

function PorEncuesta() {
  const { pedir } = useProfe();
  const [encuestas, setEncuestas] = useState<EncuestaGuardada[] | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const cargar = useCallback(() => {
    pedir<EncuestaGuardada[]>('/encuestas')
      .then(setEncuestas)
      .catch((e) => toast.error(mensajeDe(e)));
  }, [pedir]);
  useEffect(cargar, [cargar]);

  if (encuestas === null) return <Skeleton className="h-64 rounded-3xl" />;
  if (encuestas.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Vote />
            </EmptyMedia>
            <EmptyTitle>Todavía no hiciste encuestas</EmptyTitle>
            <EmptyDescription>Lanzalas desde Clase en vivo → Herramientas de la clase. Acá quedan guardadas.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {encuestas.map((e) => {
        const total = e.resultados.reduce((a, b) => a + b, 0);
        return (
          <Card key={e.id}>
            <CardHeader>
              <CardDescription className="flex flex-wrap items-center gap-2">
                {e.tipo === 'texto' ? 'Ticket de salida' : 'Encuesta'}
                {e.anonima && <Badge variant="outline">Anónima</Badge>}
                <span>
                  Comisión {e.comisionNombre}, {fecha(e.creadaEn)} h
                </span>
              </CardDescription>
              <CardTitle className="text-lg">{e.pregunta}</CardTitle>
              <CardAction className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Descargar en CSV" onClick={() => void bajar(`/encuestas/${e.id}/csv`)}>
                  <Download />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Borrar esta encuesta"
                  onClick={() =>
                    setConfirmacion({
                      titulo: '¿Borrar esta encuesta?',
                      descripcion: `Se borran "${e.pregunta}" y sus respuestas. No se puede deshacer.`,
                      accion: 'Borrar',
                      destructiva: true,
                      onConfirmar: async () => {
                        try {
                          await pedir(`/encuestas/${e.id}`, { method: 'DELETE' });
                          cargar();
                        } catch (err) {
                          toast.error(mensajeDe(err));
                        }
                      },
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{e.respondieron === 1 ? 'Respondió 1' : `Respondieron ${e.respondieron}`}.</p>
              {e.tipo === 'texto' ? (
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {e.textos.map((t, i) => (
                    <li key={i} className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                      {t.nombre && <span className="font-bold">{t.nombre}: </span>}
                      {t.texto}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {e.opciones.map((o, i) => {
                    const pct = total > 0 ? Math.round(((e.resultados[i] ?? 0) / total) * 100) : 0;
                    return (
                      <li key={i} className="relative overflow-hidden rounded-xl bg-muted/60">
                        <span className="absolute inset-y-0 left-0 bg-pd-celeste/25" style={{ width: `${pct}%` }} />
                        <span className="relative flex items-center gap-3 px-3 py-1.5 text-sm font-medium">
                          <span className={cn('min-w-0 flex-1', e.tipo === 'escala' && 'text-xl')}>{o}</span>
                          <span className="tabular-nums">
                            {e.resultados[i]} ({pct}%)
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

// --- por alumno ---------------------------------------------------------------------

function PorAlumno() {
  const { pedir } = useProfe();
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [comisionId, setComisionId] = useState('');
  const [alumnos, setAlumnos] = useState<AlumnoPublico[]>([]);
  const [alumnoId, setAlumnoId] = useState<number | null>(null);
  const [historial, setHistorial] = useState<HistorialAlumno | null>(null);

  useEffect(() => {
    pedir<Comision[]>('/comisiones')
      .then((c) => {
        setComisiones(c);
        setComisionId((id) => id || String(c.find((x) => x.cantidadAlumnos > 0)?.id ?? ''));
      })
      .catch((e) => toast.error(mensajeDe(e)));
  }, [pedir]);

  useEffect(() => {
    if (!comisionId) return;
    pedir<AlumnoPublico[]>(`/comisiones/${comisionId}/alumnos`)
      .then((a) => {
        setAlumnos(a);
        setAlumnoId(a[0]?.id ?? null);
      })
      .catch((e) => toast.error(mensajeDe(e)));
  }, [comisionId, pedir]);

  useEffect(() => {
    if (alumnoId === null) return setHistorial(null);
    pedir<HistorialAlumno>(`/resultados/alumnos/${alumnoId}`)
      .then(setHistorial)
      .catch((e) => toast.error(mensajeDe(e)));
  }, [alumnoId, pedir]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-3 px-3">
          <Select value={comisionId} onValueChange={setComisionId}>
            <SelectTrigger className="w-full" aria-label="Comisión">
              <SelectValue placeholder="Elegí una comisión" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {comisiones.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {alumnos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  aria-current={a.id === alumnoId || undefined}
                  onClick={() => setAlumnoId(a.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                    a.id === alumnoId && 'bg-secondary hover:bg-secondary',
                  )}
                >
                  <PinAvatar avatar={a.avatar} tamano={30} />
                  <span className="truncate text-sm font-medium">{a.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {historial ? (
        <Card>
          <CardHeader className="flex-row items-center gap-4">
            <PinAvatar avatar={historial.avatar} tamano={52} />
            <div>
              <CardTitle className="text-2xl">{historial.nombre}</CardTitle>
              <CardDescription>
                Comisión {historial.comisionNombre}.{' '}
                {historial.sesiones.length === 0
                  ? 'Todavía no jugó ningún quiz.'
                  : historial.sesiones.length === 1
                    ? 'Jugó 1 quiz.'
                    : `Jugó ${historial.sesiones.length} quizzes.`}
              </CardDescription>
            </div>
          </CardHeader>
          {historial.sesiones.length > 0 && (
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 font-medium">Quiz</th>
                    <th className="py-2 font-medium">Fecha</th>
                    <th className="py-2 text-right font-medium">Puesto</th>
                    <th className="py-2 text-right font-medium">Aciertos</th>
                    <th className="py-2 text-right font-medium">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.sesiones.map((s) => (
                    <tr key={s.sesionId} className="border-t">
                      <td className="py-2.5 font-medium">{s.quizTitulo}</td>
                      <td className="py-2.5 text-muted-foreground">{fecha(s.iniciadaEn)}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {ordinal(s.puesto)} de {s.de}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {s.aciertos} de {s.preguntasJugadas}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{formatoPuntos(s.puntos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">Elegí un alumno para ver su historial.</Card>
      )}
    </div>
  );
}

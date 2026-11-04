import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FileText, History, Play, Presentation, Puzzle, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  EQUIPOS,
  fechaSqlite,
  MAX_EQUIPOS,
  MIN_EQUIPOS,
  type Comision,
  type ConfigPublica,
  type Presentacion,
  type QuizResumen,
  type SesionInterrumpida,
  type TipoActividad,
} from '@aula/shared';
import { ACTIVIDADES } from '@/actividades/registro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useProfe } from '../contexto';
import { BarraEmpezar } from './BarraEmpezar';

type Actividad = 'presentacion' | 'quiz' | TipoActividad;

const claseOpcion = (elegida: boolean, habilitada = true) =>
  cn(
    'flex rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-[box-shadow,background-color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
    elegida ? 'bg-secondary ring-2 ring-pd-celeste' : habilitada && 'hover:bg-muted',
  );

/** Qué se puede hacer en clase, con una línea de qué es. Las actividades salen del registro. */
const QUE_HACER: { valor: Actividad; nombre: string; descripcion: string; icono: typeof Puzzle }[] = [
  { valor: 'quiz', nombre: 'Quiz', descripcion: 'Preguntas con puntos y ranking. Puede tener carreras de tipeo en el medio.', icono: Puzzle },
  { valor: 'presentacion', nombre: 'Presentación', descripcion: 'Pasás las diapositivas y las ven en sus compus y en la pantalla.', icono: Presentation },
  ...(Object.keys(ACTIVIDADES) as TipoActividad[]).map((t) => ({
    valor: t,
    nombre: ACTIVIDADES[t].nombre,
    descripcion: ACTIVIDADES[t].descripcion,
    icono: ACTIVIDADES[t].icono,
  })),
];

/**
 * Empezar algo en clase, en tres pasos: con qué comisión, qué van a hacer y con qué (quiz, presentación,
 * texto…). El botón para empezar queda abajo, siempre a la vista, y dice qué falta elegir.
 */
export function PreparacionClase() {
  const { pedir, presencia, controlar, controlarPresentacion, irA, presentacionElegida, elegirPresentacion } = useProfe();
  const [comisiones, setComisiones] = useState<Comision[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizResumen[] | null>(null);
  const [presentaciones, setPresentaciones] = useState<Presentacion[] | null>(null);
  const [interrumpidas, setInterrumpidas] = useState<SesionInterrumpida[]>([]);
  const [actividad, setActividad] = useState<Actividad>(presentacionElegida !== null ? 'presentacion' : 'quiz');
  const [comisionId, setComisionId] = useState<string>('');
  const [quizId, setQuizId] = useState<number | null>(null);
  const [bonus, setBonus] = useState(true);
  const [porEquipos, setPorEquipos] = useState(false);
  const [cantidadEquipos, setCantidadEquipos] = useState(2);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [c, q, p, i, cfg] = await Promise.all([
        pedir<Comision[]>('/comisiones'),
        pedir<QuizResumen[]>('/quizzes'),
        pedir<Presentacion[]>('/presentaciones'),
        pedir<SesionInterrumpida[]>('/juego/interrumpidas'),
        pedir<ConfigPublica>('/config'),
      ]);
      setComisiones(c);
      setQuizzes(q);
      setPresentaciones(p);
      setInterrumpidas(i);
      setBonus(cfg.bonusRacha);
      // Si hay una sola comisión, ya queda elegida.
      setComisionId((actual) => (actual && c.some((x) => String(x.id) === actual) ? actual : c.length === 1 ? String(c[0]!.id) : ''));
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  }, [pedir]);
  useEffect(() => void cargar(), [cargar]);

  // Desde la pestaña Presentaciones ("Presentar en clase") llega con una ya elegida.
  useEffect(() => {
    if (presentacionElegida === null) return;
    setActividad('presentacion');
    void cargar();
  }, [presentacionElegida, cargar]);

  // Por defecto, la comisión que tiene gente conectada.
  useEffect(() => {
    if (comisionId || !comisiones || comisiones.length === 0) return;
    const conGente = comisiones.find((c) => (presencia[c.id]?.length ?? 0) > 0);
    if (conGente) setComisionId(String(conGente.id));
  }, [comisiones, presencia, comisionId]);

  // Con un solo quiz que se pueda jugar, ya queda elegido.
  useEffect(() => {
    if (quizId !== null || !quizzes) return;
    const jugables = quizzes.filter((q) => q.cantidadPreguntas > 0 && q.problemas === 0);
    if (jugables.length === 1) setQuizId(jugables[0]!.id);
  }, [quizzes, quizId]);

  const iniciar = async () => {
    if (!quizId || !comisionId) return;
    setEnviando(true);
    const r = await controlar({ tipo: 'iniciar', quizId, comisionId: Number(comisionId), bonusRacha: bonus, equipos: porEquipos ? cantidadEquipos : null });
    if (!r.ok) toast.error(r.error);
    setEnviando(false);
  };

  const presentar = async () => {
    if (!presentacionElegida || !comisionId) return;
    setEnviando(true);
    const r = await controlarPresentacion({ tipo: 'iniciar', presentacionId: presentacionElegida, comisionId: Number(comisionId) });
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  const retomar = async (s: SesionInterrumpida) => {
    const r = await controlar({ tipo: 'retomar', sesionId: s.id });
    if (!r.ok) toast.error(r.error);
  };

  const descartar = async (s: SesionInterrumpida) => {
    const r = await controlar({ tipo: 'descartar', sesionId: s.id });
    if (!r.ok) toast.error(r.error);
    else {
      toast.success('Quedó guardado en Resultados con lo que se llegó a jugar');
      void cargar();
    }
  };

  const nombreComision = comisiones?.find((c) => String(c.id) === comisionId)?.nombre;
  const quizElegido = quizzes?.find((q) => q.id === quizId);
  const presentacionDeLista = presentaciones?.find((p) => p.id === presentacionElegida);

  if (comisiones !== null && comisiones.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Primero, armá una comisión</EmptyTitle>
            <EmptyDescription>Cargá el curso y la lista de alumnos. Después, desde acá empezás quizzes, presentaciones y carreras de tipeo.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => irA('comisiones')}>
            <Users data-icon="inline-start" />
            Crear una comisión
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {interrumpidas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quedaron sin terminar</CardTitle>
            <CardDescription>Se cortaron a mitad de camino (por ejemplo, se apagó la notebook). Lo respondido está guardado.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {interrumpidas.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                  <History className="size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.quizTitulo}</p>
                    <p className="text-sm text-muted-foreground">
                      Comisión {s.comisionNombre}, {fechaSqlite(s.iniciadaEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}. Se jugaron{' '}
                      {s.preguntasJugadas} de {s.total} preguntas.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void descartar(s)}>
                    Darlo por terminado
                  </Button>
                  <Button size="sm" onClick={() => void retomar(s)}>
                    <Play data-icon="inline-start" />
                    Retomar
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Empezar con la clase</CardTitle>
          <CardDescription>Elegí la comisión, qué van a hacer y con qué. Los alumnos lo ven en sus compus y en la pantalla grande.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          <Paso numero={1} titulo="¿Con qué comisión?">
            {comisiones === null ? (
              <Spinner />
            ) : (
              <div role="radiogroup" aria-label="Comisión" className="flex flex-wrap gap-2">
                {comisiones.map((c) => {
                  const n = presencia[c.id]?.length ?? 0;
                  const elegida = String(c.id) === comisionId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      onClick={() => setComisionId(String(c.id))}
                      className={cn(claseOpcion(elegida), 'items-center gap-3 py-3')}
                    >
                      <span className="font-bold">{c.nombre}</span>
                      <span className={cn('flex items-center gap-1.5 text-sm', n > 0 ? 'font-semibold text-bien-texto' : 'text-muted-foreground')}>
                        <span className={cn('size-2 rounded-full', n > 0 ? 'bg-pd-resp-b' : 'bg-muted-foreground/40')} aria-hidden />
                        {n === 0 ? 'nadie conectado' : n === 1 ? '1 conectado' : `${n} conectados`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {comisionId && (presencia[Number(comisionId)]?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no entró nadie. Pueden sumarse cuando ya hayas empezado.</p>
            )}
          </Paso>

          <Paso numero={2} titulo="¿Qué van a hacer?">
            <div role="radiogroup" aria-label="Qué van a hacer" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUE_HACER.map(({ valor, nombre, descripcion, icono: Icono }) => {
                const elegida = actividad === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => setActividad(valor)}
                    className={cn(claseOpcion(elegida), 'items-start gap-3')}
                  >
                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-2xl transition-colors',
                        elegida ? 'bg-pd-celeste-oscuro text-white' : 'bg-pd-celeste-claro text-pd-celeste-oscuro',
                      )}
                    >
                      <Icono className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-lg font-bold">{nombre}</span>
                      <span className="text-sm text-muted-foreground">{descripcion}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Paso>

          <Paso
            numero={3}
            titulo={actividad === 'quiz' ? '¿Qué quiz?' : actividad === 'presentacion' ? '¿Qué presentación?' : ACTIVIDADES[actividad].paso3}
          >
            {actividad !== 'presentacion' && actividad !== 'quiz' ? (
              <PrepararActividad tipo={actividad} comisionId={comisionId} nombreComision={nombreComision} />
            ) : actividad === 'presentacion' ? (
              <>
                {presentaciones === null ? (
                  <Spinner />
                ) : presentaciones.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileText />
                      </EmptyMedia>
                      <EmptyTitle>Todavía no hay presentaciones</EmptyTitle>
                      <EmptyDescription>Subí tus PDFs en la pestaña Presentaciones.</EmptyDescription>
                    </EmptyHeader>
                    <Button variant="outline" onClick={() => irA('presentaciones')}>
                      Ir a Presentaciones
                    </Button>
                  </Empty>
                ) : (
                  <div role="radiogroup" aria-label="Presentación" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {presentaciones.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={presentacionElegida === p.id}
                        onClick={() => elegirPresentacion(p.id)}
                        className={cn(claseOpcion(presentacionElegida === p.id), 'items-center gap-3')}
                      >
                        <FileText className="size-6 flex-none text-pd-celeste-oscuro" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-bold">{p.titulo}</span>
                          <span className="text-sm text-muted-foreground">{p.paginas === 1 ? '1 diapositiva' : `${p.paginas} diapositivas`}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <BarraEmpezar
                  resumen={
                    !comisionId
                      ? 'Elegí la comisión arriba'
                      : !presentacionDeLista
                        ? 'Elegí una presentación'
                        : `${presentacionDeLista.titulo}, comisión ${nombreComision ?? ''}`
                  }
                  falta={!presentacionDeLista || !comisionId}
                  texto="Empezar a presentar"
                  enviando={enviando}
                  onEmpezar={() => void presentar()}
                />
              </>
            ) : (
              <>
                {quizzes === null ? (
                  <Spinner />
                ) : quizzes.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Puzzle />
                      </EmptyMedia>
                      <EmptyTitle>Todavía no hay quizzes</EmptyTitle>
                      <EmptyDescription>Crealos en la pestaña Quizzes (o importalos armados con Claude).</EmptyDescription>
                    </EmptyHeader>
                    <Button variant="outline" onClick={() => irA('quizzes')}>
                      Ir a Quizzes
                    </Button>
                  </Empty>
                ) : (
                  <div role="radiogroup" aria-label="Quiz" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {quizzes.map((q) => {
                      const jugable = q.cantidadPreguntas > 0 && q.problemas === 0;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          role="radio"
                          aria-checked={quizId === q.id}
                          disabled={!jugable}
                          onClick={() => setQuizId(q.id)}
                          className={cn(claseOpcion(quizId === q.id, jugable), 'flex-col gap-1')}
                        >
                          <span className="font-bold">{q.titulo}</span>
                          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {q.cantidadPreguntas === 1 ? '1 pregunta' : `${q.cantidadPreguntas} preguntas`}
                            {q.problemas > 0 && <Badge variant="destructive">Le faltan cosas: completalo en Quizzes</Badge>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-4 rounded-3xl bg-muted/50 p-4">
                  <p className="text-sm font-semibold text-muted-foreground">Cómo se juega</p>
                  <Field orientation="horizontal" className="max-w-lg">
                    <Switch id="bonus-racha" checked={bonus} onCheckedChange={setBonus} />
                    <FieldContent>
                      <FieldLabel htmlFor="bonus-racha">Bonus por racha</FieldLabel>
                      <FieldDescription>Desde la 2.ª correcta seguida suma +100, +200… hasta +500 por pregunta.</FieldDescription>
                    </FieldContent>
                  </Field>
                  <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                    <Field orientation="horizontal" className="max-w-lg">
                      <Switch id="por-equipos" checked={porEquipos} onCheckedChange={setPorEquipos} />
                      <FieldContent>
                        <FieldLabel htmlFor="por-equipos">Por equipos</FieldLabel>
                        <FieldDescription>Se reparten solos y parejos. Gana el equipo con mejor promedio, así no importa cuántos sean.</FieldDescription>
                      </FieldContent>
                    </Field>
                    {porEquipos && (
                      <Field className="w-fit">
                        <FieldLabel id="cantidad-equipos">Cantidad de equipos</FieldLabel>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          aria-labelledby="cantidad-equipos"
                          value={String(cantidadEquipos)}
                          onValueChange={(v) => v && setCantidadEquipos(Number(v))}
                        >
                          {Array.from({ length: MAX_EQUIPOS - MIN_EQUIPOS + 1 }, (_, i) => MIN_EQUIPOS + i).map((n) => (
                            <ToggleGroupItem key={n} value={String(n)} aria-label={`${n} equipos`}>
                              {n}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        <FieldDescription>
                          {EQUIPOS.slice(0, cantidadEquipos)
                            .map((e) => `${e.mascota} ${e.nombre}`)
                            .join('  ')}
                        </FieldDescription>
                      </Field>
                    )}
                  </div>
                </div>

                <BarraEmpezar
                  resumen={
                    !comisionId
                      ? 'Elegí la comisión arriba'
                      : !quizElegido
                        ? 'Elegí un quiz'
                        : `${quizElegido.titulo}, comisión ${nombreComision ?? ''}${porEquipos ? `, en ${cantidadEquipos} equipos` : ''}`
                  }
                  falta={!quizElegido || !comisionId}
                  texto="Abrir la sala de espera"
                  enviando={enviando}
                  onEmpezar={() => void iniciar()}
                />
              </>
            )}
          </Paso>
        </CardContent>
      </Card>
    </div>
  );
}

/** Un paso de la preparación: número, pregunta y lo que hay que elegir. */
function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={titulo}>
      <h3 className="flex items-center gap-3 text-lg font-bold">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-sm font-extrabold text-white tabular-nums">
          {numero}
        </span>
        {titulo}
      </h3>
      <div className="flex flex-col gap-4 sm:pl-11">{children}</div>
    </section>
  );
}

function PrepararActividad({ tipo, comisionId, nombreComision }: { tipo: TipoActividad; comisionId: string; nombreComision?: string }) {
  const Preparar = ACTIVIDADES[tipo].Preparar;
  return <Preparar comisionId={comisionId} nombreComision={nombreComision} />;
}

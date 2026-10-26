import { useCallback, useEffect, useState } from 'react';
import { FileText, History, Play, Presentation, Puzzle } from 'lucide-react';
import { toast } from 'sonner';
import {
  fechaSqlite,
  type Comision,
  type ConfigPublica,
  type Presentacion,
  type QuizResumen,
  type SesionInterrumpida,
} from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useProfe } from '../contexto';

type Actividad = 'presentacion' | 'quiz';

const claseOpcion = (elegida: boolean, habilitada = true) =>
  cn(
    'flex rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-[box-shadow,background-color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
    elegida ? 'bg-secondary ring-2 ring-pd-celeste' : habilitada && 'hover:bg-muted',
  );

export function PreparacionClase() {
  const { pedir, presencia, controlar, controlarPresentacion, irA, presentacionElegida, elegirPresentacion } = useProfe();
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [quizzes, setQuizzes] = useState<QuizResumen[] | null>(null);
  const [presentaciones, setPresentaciones] = useState<Presentacion[] | null>(null);
  const [interrumpidas, setInterrumpidas] = useState<SesionInterrumpida[]>([]);
  const [actividad, setActividad] = useState<Actividad>(presentacionElegida !== null ? 'presentacion' : 'quiz');
  const [comisionId, setComisionId] = useState<string>('');
  const [quizId, setQuizId] = useState<number | null>(null);
  const [bonus, setBonus] = useState(true);
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
      setComisionId((actual) => (actual && c.some((x) => String(x.id) === actual) ? actual : ''));
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
    if (comisionId || comisiones.length === 0) return;
    const conGente = comisiones.find((c) => (presencia[c.id]?.length ?? 0) > 0);
    if (conGente) setComisionId(String(conGente.id));
  }, [comisiones, presencia, comisionId]);

  const iniciar = async () => {
    if (!quizId || !comisionId) return;
    setEnviando(true);
    const r = await controlar({ tipo: 'iniciar', quizId, comisionId: Number(comisionId), bonusRacha: bonus });
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

  const conectadosElegida = comisionId ? (presencia[Number(comisionId)]?.length ?? 0) : 0;
  const nombreComision = comisiones.find((c) => String(c.id) === comisionId)?.nombre;
  const quizElegido = quizzes?.find((q) => q.id === quizId);
  const presentacionDeLista = presentaciones?.find((p) => p.id === presentacionElegida);
  const elegida = actividad === 'quiz' ? quizElegido : presentacionDeLista;

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
                      Comisión {s.comisionNombre}, {fechaSqlite(s.iniciadaEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.
                      Se jugaron {s.preguntasJugadas} de {s.total} preguntas.
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
          <CardDescription>
            {actividad === 'quiz'
              ? 'Los alumnos responden en sus compus y la pregunta aparece en la pantalla grande.'
              : 'Pasás las diapositivas y los alumnos las ven al instante en sus compus y en la pantalla grande.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
            <Field className="w-full max-w-sm">
              <FieldLabel htmlFor="comision-clase">Comisión</FieldLabel>
              <Select value={comisionId} onValueChange={setComisionId}>
                <SelectTrigger id="comision-clase" className="w-full">
                  <SelectValue placeholder="Elegí una comisión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {comisiones.map((c) => {
                      const n = presencia[c.id]?.length ?? 0;
                      return (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nombre}
                          {n > 0 && <span className="text-muted-foreground">({n === 1 ? '1 conectado' : `${n} conectados`})</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {comisionId && (
                <FieldDescription>
                  {conectadosElegida === 0
                    ? 'Todavía no entró nadie. Pueden sumarse cuando ya hayas empezado.'
                    : `${conectadosElegida === 1 ? 'Hay 1 alumno conectado' : `Hay ${conectadosElegida} alumnos conectados`}.`}
                </FieldDescription>
              )}
            </Field>

            <Field className="w-fit">
              <FieldLabel id="actividad-clase">Actividad</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby="actividad-clase"
                value={actividad}
                onValueChange={(v) => v && setActividad(v as Actividad)}
              >
                <ToggleGroupItem value="presentacion">
                  <Presentation />
                  Presentación
                </ToggleGroupItem>
                <ToggleGroupItem value="quiz">
                  <Puzzle />
                  Quiz
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>

          {actividad === 'presentacion' ? (
            <FieldSet>
              <FieldLegend variant="label">Presentación</FieldLegend>
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
                        <span className="text-sm text-muted-foreground">
                          {p.paginas === 1 ? '1 diapositiva' : `${p.paginas} diapositivas`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </FieldSet>
          ) : (
            <>
              <FieldSet>
                <FieldLegend variant="label">Quiz</FieldLegend>
                {quizzes === null ? (
                  <Spinner />
                ) : quizzes.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Puzzle />
                      </EmptyMedia>
                      <EmptyTitle>Todavía no hay quizzes</EmptyTitle>
                      <EmptyDescription>Crealos en la pestaña Quizzes.</EmptyDescription>
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
                            {q.problemas > 0 && <Badge variant="destructive">Le faltan cosas</Badge>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </FieldSet>

              <Field orientation="horizontal" className="max-w-lg">
                <Switch id="bonus-racha" checked={bonus} onCheckedChange={setBonus} />
                <FieldContent>
                  <FieldLabel htmlFor="bonus-racha">Bonus por racha</FieldLabel>
                  <FieldDescription>Desde la 2.ª correcta seguida suma +100, +200… hasta +500 por pregunta.</FieldDescription>
                </FieldContent>
              </Field>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-3 border-t-0 bg-transparent">
          {elegida && nombreComision && (
            <span className="text-sm text-muted-foreground">
              {elegida.titulo} con la comisión {nombreComision}
            </span>
          )}
          {actividad === 'quiz' ? (
            <Button size="lg" disabled={!quizElegido || !comisionId || enviando} onClick={() => void iniciar()}>
              {enviando ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              Abrir la sala de espera
            </Button>
          ) : (
            <Button size="lg" disabled={!presentacionDeLista || !comisionId || enviando} onClick={() => void presentar()}>
              {enviando ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              Empezar a presentar
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

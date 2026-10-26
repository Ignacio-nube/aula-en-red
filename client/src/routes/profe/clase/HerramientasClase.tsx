import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, Lock, Plus, Square, Vote, X } from 'lucide-react';
import { toast } from 'sonner';
import { CARITAS_ESCALA, type Comision, type EncuestaEnVivo, type TipoEncuesta } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { emitirConAck } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { useProfe } from '../contexto';

/** La comisión a la que apuntan las herramientas: la de lo que esté en curso, o la que tenga más gente. */
function useComisionObjetivo(): [number | null, (id: number) => void, Comision[]] {
  const { pedir, presencia, juego, presentacion, encuesta } = useProfe();
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  useEffect(() => {
    pedir<Comision[]>('/comisiones')
      .then(setComisiones)
      .catch(() => {});
  }, [pedir]);
  const enCurso = (juego.estado && juego.estado.fase !== 'podio' ? juego.estado.comisionId : null) ?? presentacion?.comisionId ?? encuesta?.comisionId ?? null;
  const conMasGente = [...comisiones].sort((a, b) => (presencia[b.id]?.length ?? 0) - (presencia[a.id]?.length ?? 0))[0]?.id ?? null;
  return [enCurso ?? elegida ?? conMasGente, setElegida, comisiones];
}

export function HerramientasClase() {
  const { socket, atencion, encuesta, juego, presentacion } = useProfe();
  const [comisionId, setComisionId, comisiones] = useComisionObjetivo();
  const [mensaje, setMensaje] = useState('Miren al frente');
  const [creando, setCreando] = useState(false);
  const hayQuiz = juego.estado !== null && juego.estado.fase !== 'podio';
  const fija = hayQuiz || presentacion !== null || encuesta !== null;
  const nombre = comisiones.find((c) => c.id === comisionId)?.nombre;

  const cambiarAtencion = async (activa: boolean) => {
    const r = await emitirConAck(socket, 'atencion:cambiar', activa ? { mensaje, comisionId } : null);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Herramientas de la clase</CardTitle>
        <CardDescription>
          {comisionId === null
            ? 'Cuando haya alumnos conectados, vas a poder usarlas.'
            : fija
              ? `Para la comisión ${nombre ?? ''}, la de lo que está en curso.`
              : comisiones.length > 1
                ? 'Elegí para qué comisión.'
                : `Para la comisión ${nombre ?? ''}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!fija && comisiones.length > 1 && (
          <Field className="max-w-xs">
            <FieldLabel htmlFor="comision-herramientas">Comisión</FieldLabel>
            <Select value={comisionId ? String(comisionId) : ''} onValueChange={(v) => setComisionId(Number(v))}>
              <SelectTrigger id="comision-herramientas" className="w-full">
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
          </Field>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Miren al frente */}
          <div className={cn('flex flex-col gap-3 rounded-3xl p-4 transition-colors', atencion ? 'bg-pd-celeste-claro ring-2 ring-pd-celeste' : 'bg-muted/60')}>
            <Field orientation="horizontal">
              <Switch
                id="miren-al-frente"
                checked={atencion !== null}
                disabled={comisionId === null}
                onCheckedChange={(v) => void cambiarAtencion(v)}
              />
              <FieldContent>
                <FieldLabel htmlFor="miren-al-frente" className="text-base font-bold">
                  <Eye className="size-5" />
                  Miren al frente
                </FieldLabel>
                <FieldDescription>
                  {atencion ? 'Las compus de los alumnos muestran el mensaje en grande.' : 'Tapa la pantalla de los alumnos con un mensaje. No bloquea la compu.'}
                </FieldDescription>
              </FieldContent>
            </Field>
            {!atencion && (
              <Input
                aria-label="Mensaje"
                value={mensaje}
                maxLength={80}
                onChange={(e) => setMensaje(e.target.value)}
                className="bg-card"
              />
            )}
          </div>

          {/* Encuesta rápida */}
          <div className="flex flex-col gap-3 rounded-3xl bg-muted/60 p-4">
            <div className="flex items-center gap-2 text-base font-bold">
              <Vote className="size-5" />
              Encuesta rápida o ticket de salida
            </div>
            <p className="text-sm text-muted-foreground">
              {hayQuiz ? 'Esperá a que termine el quiz.' : encuesta ? 'Hay una encuesta en curso (arriba).' : 'Una pregunta para toda la clase: con opciones, caritas o texto libre.'}
            </p>
            <Button className="self-start" disabled={hayQuiz || encuesta !== null || comisionId === null} onClick={() => setCreando(true)}>
              <Plus data-icon="inline-start" />
              Nueva encuesta
            </Button>
          </div>
        </div>
      </CardContent>
      {comisionId !== null && <DialogoEncuesta abierto={creando} onCerrar={() => setCreando(false)} comisionId={comisionId} />}
    </Card>
  );
}

const PLANTILLAS: { nombre: string; pregunta: string; tipo: TipoEncuesta; opciones: string[] }[] = [
  { nombre: '¿Se entendió?', pregunta: '¿Cuánto entendiste el tema de hoy?', tipo: 'escala', opciones: [] },
  { nombre: 'Ticket de salida', pregunta: '¿Qué te llevás de la clase de hoy?', tipo: 'texto', opciones: [] },
  { nombre: 'Votación', pregunta: '¿Qué hacemos la próxima clase?', tipo: 'opciones', opciones: ['Seguimos con el tema', 'Un quiz de repaso', 'Práctica en la compu'] },
];

function DialogoEncuesta({ abierto, onCerrar, comisionId }: { abierto: boolean; onCerrar: () => void; comisionId: number }) {
  const { socket } = useProfe();
  const [pregunta, setPregunta] = useState(PLANTILLAS[0]!.pregunta);
  const [tipo, setTipo] = useState<TipoEncuesta>('escala');
  const [opciones, setOpciones] = useState<string[]>(['', '']);
  const [anonima, setAnonima] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const usar = (p: (typeof PLANTILLAS)[number]) => {
    setPregunta(p.pregunta);
    setTipo(p.tipo);
    if (p.opciones.length) setOpciones(p.opciones);
    // El ticket de salida suele ser con nombre: el profe quiere saber quién escribió qué.
    setAnonima(p.tipo !== 'texto');
  };

  const validas = opciones.map((o) => o.trim()).filter(Boolean);
  const lista = pregunta.trim().length >= 3 && (tipo !== 'opciones' || validas.length >= 2);

  const lanzar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lista) return;
    setEnviando(true);
    const r = await emitirConAck(socket, 'encuesta:control', { tipo: 'iniciar', comisionId, pregunta, tipoEncuesta: tipo, opciones: validas, anonima });
    setEnviando(false);
    if (!r.ok) return void toast.error(r.error);
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={lanzar} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Nueva encuesta</DialogTitle>
            <DialogDescription>Aparece en las compus de los alumnos y en la pantalla grande.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {PLANTILLAS.map((p) => (
              <Button key={p.nombre} type="button" variant="secondary" size="sm" onClick={() => usar(p)}>
                {p.nombre}
              </Button>
            ))}
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pregunta-encuesta">Pregunta</FieldLabel>
              <Input id="pregunta-encuesta" value={pregunta} maxLength={200} onChange={(e) => setPregunta(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel id="tipo-encuesta">Respuestas</FieldLabel>
              <ToggleGroup type="single" variant="outline" aria-labelledby="tipo-encuesta" value={tipo} onValueChange={(v) => v && setTipo(v as TipoEncuesta)}>
                <ToggleGroupItem value="escala">Caritas {CARITAS_ESCALA[0]}…{CARITAS_ESCALA[4]}</ToggleGroupItem>
                <ToggleGroupItem value="opciones">Opciones</ToggleGroupItem>
                <ToggleGroupItem value="texto">Texto libre</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <AnimatePresence initial={false}>
              {tipo === 'opciones' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex flex-col gap-2 p-0.5">
                    {opciones.map((o, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          aria-label={`Opción ${i + 1}`}
                          placeholder={`Opción ${i + 1}`}
                          value={o}
                          maxLength={60}
                          onChange={(e) => setOpciones(opciones.map((x, j) => (j === i ? e.target.value : x)))}
                        />
                        {opciones.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la opción ${i + 1}`} onClick={() => setOpciones(opciones.filter((_, j) => j !== i))}>
                            <X />
                          </Button>
                        )}
                      </div>
                    ))}
                    {opciones.length < 6 && (
                      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setOpciones([...opciones, ''])}>
                        <Plus data-icon="inline-start" />
                        Agregar opción
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Field orientation="horizontal">
              <Switch id="anonima" checked={anonima} onCheckedChange={setAnonima} />
              <FieldContent>
                <FieldLabel htmlFor="anonima">Anónima</FieldLabel>
                <FieldDescription>
                  {anonima ? 'No vas a ver quién respondió qué (ni queda guardado).' : 'Vas a ver el nombre de cada uno junto a su respuesta.'}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!lista || enviando}>
              {enviando ? <Spinner data-icon="inline-start" /> : <Vote data-icon="inline-start" />}
              Lanzar encuesta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Encuesta en curso: resultados en vivo (solo para el profe mientras está abierta). */
export function ControlEncuesta({ encuesta: e }: { encuesta: EncuestaEnVivo }) {
  const { socket } = useProfe();
  const control = async (tipo: 'cerrar' | 'quitar') => {
    const r = await emitirConAck(socket, 'encuesta:control', { tipo });
    if (!r.ok) toast.error(r.error);
  };
  const total = e.resultados?.reduce((a, b) => a + b, 0) ?? 0;
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <Card className="ring-2 ring-pd-celeste">
        <CardHeader>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge>{e.abierta ? 'Encuesta abierta' : 'Encuesta cerrada'}</Badge>
            {e.anonima && (
              <Badge variant="outline">
                <Lock data-icon="inline-start" />
                Anónima
              </Badge>
            )}
            Comisión {e.comisionNombre}
          </CardDescription>
          <CardTitle className="text-xl">{e.pregunta}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm font-semibold">
            <motion.span key={e.respondieron} className="inline-block text-lg tabular-nums" initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
              {e.respondieron}
            </motion.span>{' '}
            de {e.conectados} respondieron
            {e.abierta && e.tipo !== 'texto' && <span className="font-normal text-muted-foreground"> · los resultados los ves solo vos hasta que la cierres</span>}
          </p>

          {e.tipo === 'texto' ? (
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {(e.textos ?? []).length === 0 && <li className="text-sm text-muted-foreground">Todavía no llegó ninguna respuesta.</li>}
              <AnimatePresence initial={false}>
                {(e.textos ?? []).map((t, i) => (
                  <motion.li key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-muted/60 px-3 py-2 text-sm">
                    {t.nombre && <span className="font-bold">{t.nombre}: </span>}
                    {t.texto}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {e.opciones.map((o, i) => {
                const votos = e.resultados?.[i] ?? 0;
                const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
                return (
                  <li key={i} className="relative overflow-hidden rounded-xl bg-muted/60">
                    <motion.span
                      className="absolute inset-y-0 left-0 bg-pd-celeste/30"
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                    />
                    <span className="relative flex items-center gap-3 px-3 py-2 text-sm font-semibold">
                      <span className={cn('min-w-0 flex-1', e.tipo === 'escala' && 'text-2xl')}>{o}</span>
                      <span className="tabular-nums">
                        {votos} <span className="font-normal text-muted-foreground">({pct}%)</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {e.abierta ? (
              <Button onClick={() => void control('cerrar')}>Cerrar y mostrar resultados</Button>
            ) : (
              <Button onClick={() => void control('quitar')}>
                <Square data-icon="inline-start" />
                Terminar encuesta
              </Button>
            )}
            {e.abierta && (
              <Button variant="ghost" onClick={() => void control('quitar')}>
                Terminar sin mostrar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Queda guardada en Resultados → Encuestas.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

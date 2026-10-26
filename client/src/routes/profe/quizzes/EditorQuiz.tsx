import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ChevronLeft, CircleAlert, Eye, GripVertical, ListChecks, ListOrdered, Plus, Save, SquareCheckBig, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITES, NOMBRE_TIPO, type Quiz, type TipoPregunta } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';
import { aBorrador, aEntrada, duplicarPregunta, preguntaNueva, problemas, type PreguntaBorrador, type QuizBorrador } from './borrador';
import { EditorPregunta } from './EditorPregunta';
import { VistaPrevia } from './VistaPrevia';

export function EditorQuiz({ id, onSalir }: { id: number; onSalir: () => void }) {
  const { pedir } = useProfe();
  const [borrador, setBorrador] = useState<QuizBorrador | null>(null);
  const [guardadoJson, setGuardadoJson] = useState('');
  const [elegida, setElegida] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  // Solo al abrir: si se recargara en cada render se pisaría lo que se está editando.
  const salirRef = useRef(onSalir);
  salirRef.current = onSalir;
  useEffect(() => {
    pedir<Quiz>(`/quizzes/${id}`)
      .then((q) => {
        const b = aBorrador(q);
        setBorrador(b);
        setGuardadoJson(JSON.stringify(aEntrada(b)));
      })
      .catch((e) => {
        toast.error(mensajeDe(e));
        salirRef.current();
      });
  }, [id, pedir]);

  const json = useMemo(() => (borrador ? JSON.stringify(aEntrada(borrador)) : ''), [borrador]);
  const hayCambios = borrador !== null && json !== guardadoJson;

  const guardar = useCallback(async (): Promise<boolean> => {
    if (!borrador) return false;
    setGuardando(true);
    try {
      const entrada = aEntrada(borrador);
      const q = await pedir<Quiz>(`/quizzes/${id}`, { method: 'PUT', body: entrada });
      // El servidor normaliza (espacios, límites): se toma su versión como la guardada.
      const b = aBorrador(q);
      setBorrador((actual) =>
        actual ? { ...b, preguntas: b.preguntas.map((p, i) => ({ ...p, clave: actual.preguntas[i]?.clave ?? p.clave })) } : b,
      );
      setGuardadoJson(JSON.stringify(aEntrada(b)));
      toast.success('Guardaste el quiz');
      return true;
    } catch (e) {
      toast.error(mensajeDe(e));
      return false;
    } finally {
      setGuardando(false);
    }
  }, [borrador, id, pedir]);

  // Ctrl+S guarda; cerrar la pestaña con cambios pide confirmación.
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void guardarRef.current();
      }
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, []);
  useEffect(() => {
    if (!hayCambios) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [hayCambios]);

  const salir = () => {
    if (!hayCambios) return onSalir();
    setConfirmacion({
      titulo: 'Tenés cambios sin guardar',
      descripcion: 'Si salís ahora, se pierden.',
      accion: 'Salir sin guardar',
      destructiva: true,
      onConfirmar: onSalir,
    });
  };

  if (!borrador) {
    return (
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  const preguntas = borrador.preguntas;
  const actual = preguntas[Math.min(elegida, preguntas.length - 1)];
  const cambiarPreguntas = (f: (ps: PreguntaBorrador[]) => PreguntaBorrador[]) => setBorrador((b) => (b ? { ...b, preguntas: f(b.preguntas) } : b));

  const agregar = (tipo: TipoPregunta) => {
    if (preguntas.length >= LIMITES.preguntas) return toast.error(`Un quiz puede tener hasta ${LIMITES.preguntas} preguntas.`);
    // La nueva hereda tiempo y puntos de la que estás editando: suelen repetirse.
    const nueva = preguntaNueva(tipo, actual);
    const i = Math.min(elegida, preguntas.length - 1) + 1;
    cambiarPreguntas((ps) => [...ps.slice(0, i), nueva, ...ps.slice(i)]);
    setElegida(i);
  };

  const incompletas = preguntas.filter((p) => problemas(p).length > 0).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Barra del editor: queda fija debajo del encabezado, así Guardar siempre está a mano */}
      <div className="vidrio sticky top-(--alto-barra) z-20 -mx-4 -mt-6 flex flex-wrap items-center gap-3 rounded-b-3xl px-4 py-2 shadow-[var(--pd-sombra-tarjeta)] sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={salir}>
          <ChevronLeft data-icon="inline-start" />
          Quizzes
        </Button>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <Input
            aria-label="Título del quiz"
            value={borrador.titulo}
            maxLength={LIMITES.titulo}
            onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })}
            className="h-12 border-transparent bg-transparent text-2xl font-extrabold shadow-none hover:border-input focus-visible:bg-card md:text-2xl"
          />
          <Input
            aria-label="Descripción (opcional)"
            placeholder="Descripción (opcional): de qué tema es, para qué clase…"
            value={borrador.descripcion}
            maxLength={LIMITES.descripcion}
            onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
            className="h-9 border-transparent bg-transparent text-sm text-muted-foreground shadow-none hover:border-input focus-visible:bg-card"
          />
        </div>
        <span className={cn('text-sm font-medium', hayCambios ? 'text-foreground' : 'text-muted-foreground')} aria-live="polite">
          {guardando ? 'Guardando…' : hayCambios ? 'Cambios sin guardar' : 'Todo guardado'}
        </span>
        <Button variant="outline" onClick={() => setVistaPrevia(true)} disabled={!actual}>
          <Eye data-icon="inline-start" />
          Vista previa
        </Button>
        <Button onClick={() => void guardar()} disabled={!hayCambios || guardando}>
          {guardando ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Lista de preguntas, reordenable arrastrando */}
        <Card className="gap-3 lg:sticky lg:top-[calc(var(--alto-barra)+7.5rem)]">
          <div className="flex items-center justify-between px-5">
            <h3 className="font-bold">{preguntas.length === 1 ? '1 pregunta' : `${preguntas.length} preguntas`}</h3>
            {incompletas > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium text-destructive">
                <CircleAlert className="size-4" />
                {incompletas} por completar
              </span>
            )}
          </div>
          <Reorder.Group
            axis="y"
            values={preguntas}
            onReorder={(ps) => {
              const clave = actual?.clave;
              cambiarPreguntas(() => ps);
              setElegida(Math.max(0, ps.findIndex((p) => p.clave === clave)));
            }}
            className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto px-3"
          >
            {preguntas.map((p, i) => (
              <ItemPregunta key={p.clave} pregunta={p} numero={i + 1} activa={p.clave === actual?.clave} onElegir={() => setElegida(i)} />
            ))}
          </Reorder.Group>
          <div className="grid grid-cols-2 gap-2 px-3">
            <Button variant="secondary" size="sm" onClick={() => agregar('multiple')}>
              <Plus data-icon="inline-start" />
              Opción múltiple
            </Button>
            <Button variant="secondary" size="sm" onClick={() => agregar('vf')}>
              <Plus data-icon="inline-start" />
              Verdadero/Falso
            </Button>
            <Button variant="secondary" size="sm" onClick={() => agregar('varias')}>
              <Plus data-icon="inline-start" />
              Varias correctas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => agregar('ordenar')}>
              <Plus data-icon="inline-start" />
              Ordenar pasos
            </Button>
          </div>
        </Card>

        {actual ? (
          <EditorPregunta
            key={actual.clave}
            pregunta={actual}
            numero={preguntas.indexOf(actual) + 1}
            puedeBorrar={preguntas.length > 1}
            onCambiar={(nueva) => cambiarPreguntas((ps) => ps.map((p) => (p.clave === nueva.clave ? nueva : p)))}
            onDuplicar={() => {
              const i = preguntas.indexOf(actual);
              cambiarPreguntas((ps) => [...ps.slice(0, i + 1), duplicarPregunta(actual), ...ps.slice(i + 1)]);
              setElegida(i + 1);
            }}
            onBorrar={() => {
              const i = preguntas.indexOf(actual);
              cambiarPreguntas((ps) => ps.filter((p) => p.clave !== actual.clave));
              setElegida(Math.max(0, i - 1));
            }}
          />
        ) : (
          <Card className="p-10 text-center text-muted-foreground">Agregá una pregunta para empezar.</Card>
        )}
      </div>

      {actual && (
        <VistaPrevia abierta={vistaPrevia} onCerrar={() => setVistaPrevia(false)} pregunta={actual} numero={preguntas.indexOf(actual)} total={preguntas.length} />
      )}
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

const ICONO_TIPO: Record<TipoPregunta, typeof ListChecks> = {
  multiple: ListChecks,
  vf: ToggleLeft,
  varias: SquareCheckBig,
  ordenar: ListOrdered,
};

function ItemPregunta({ pregunta, numero, activa, onElegir }: { pregunta: PreguntaBorrador; numero: number; activa: boolean; onElegir: () => void }) {
  const arrastre = useDragControls();
  const faltan = problemas(pregunta).length > 0;
  const Icono = ICONO_TIPO[pregunta.tipo];
  return (
    <Reorder.Item
      value={pregunta}
      dragListener={false}
      dragControls={arrastre}
      className={cn(
        'flex items-center gap-1 rounded-2xl bg-card transition-colors select-none',
        activa ? 'bg-secondary ring-2 ring-pd-celeste' : 'hover:bg-muted',
      )}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--pd-sombra-flotante)' }}
    >
      <button
        type="button"
        aria-label={`Arrastrar la pregunta ${numero} para cambiarla de lugar`}
        onPointerDown={(e) => arrastre.start(e)}
        className="cursor-grab touch-none rounded-lg p-2 text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onElegir} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left outline-none">
        <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">{numero}</span>
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', !pregunta.texto && 'text-muted-foreground italic')}>
          {pregunta.texto || 'Sin texto'}
        </span>
        <Icono className="size-4 shrink-0 text-muted-foreground" aria-label={NOMBRE_TIPO[pregunta.tipo]} />
        {faltan && <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="Le falta algo" />}
      </button>
    </Reorder.Item>
  );
}

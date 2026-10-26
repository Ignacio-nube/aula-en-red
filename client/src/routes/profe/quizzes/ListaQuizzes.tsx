import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Copy, EllipsisVertical, Pencil, Plus, Puzzle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fechaSqlite, type Quiz, type QuizResumen } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDe } from '@/lib/api';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';

const relativo = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
export function haceCuanto(fecha: string): string {
  const seg = (fechaSqlite(fecha).getTime() - Date.now()) / 1000;
  const abs = Math.abs(seg);
  if (abs < 60) return 'recién';
  if (abs < 3600) return relativo.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return relativo.format(Math.round(seg / 3600), 'hour');
  if (abs < 86400 * 30) return relativo.format(Math.round(seg / 86400), 'day');
  return fechaSqlite(fecha).toLocaleDateString('es-AR');
}

export function ListaQuizzes({ onEditar }: { onEditar: (id: number) => void }) {
  const { pedir } = useProfe();
  const [quizzes, setQuizzes] = useState<QuizResumen[] | null>(null);
  const [creando, setCreando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  const cargar = useCallback(() => {
    pedir<QuizResumen[]>('/quizzes')
      .then(setQuizzes)
      .catch((e) => toast.error(mensajeDe(e)));
  }, [pedir]);
  useEffect(cargar, [cargar]);

  const crear = async () => {
    setCreando(true);
    try {
      const q = await pedir<Quiz>('/quizzes', { method: 'POST', body: { titulo: 'Quiz sin título' } });
      onEditar(q.id);
    } catch (e) {
      toast.error(mensajeDe(e));
      setCreando(false);
    }
  };

  const duplicar = async (q: QuizResumen) => {
    try {
      await pedir(`/quizzes/${q.id}/duplicar`, { method: 'POST' });
      toast.success(`Duplicaste "${q.titulo}"`);
      cargar();
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  };

  const borrar = (q: QuizResumen) =>
    setConfirmacion({
      titulo: `¿Borrar "${q.titulo}"?`,
      descripcion: 'Los resultados de las veces que se jugó quedan guardados en Resultados.',
      accion: 'Borrar quiz',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(`/quizzes/${q.id}`, { method: 'DELETE' });
          cargar();
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  const botonNuevo = (
    <Button onClick={crear} disabled={creando}>
      {creando ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
      Nuevo quiz
    </Button>
  );

  if (quizzes === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Puzzle />
            </EmptyMedia>
            <EmptyTitle>Creá tu primer quiz</EmptyTitle>
            <EmptyDescription>Preguntas de opción múltiple o verdadero/falso, con imagen, tiempo y puntaje doble.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{botonNuevo}</EmptyContent>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Quizzes</h2>
        {botonNuevo}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((q, i) => (
          <motion.li
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.03 }}
          >
            <Card className="h-full transition-shadow hover:shadow-[var(--pd-sombra-flotante)]">
              <div className="flex h-full flex-col gap-3 px-5">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onEditar(q.id)}
                    className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <h3 className="text-lg leading-snug font-bold">{q.titulo}</h3>
                    {q.descripcion && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.descripcion}</p>}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${q.titulo}`}>
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => onEditar(q.id)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void duplicar(q)}>
                          <Copy />
                          Duplicar
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem variant="destructive" onSelect={() => borrar(q)}>
                          <Trash2 />
                          Borrar
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {q.cantidadPreguntas === 1 ? '1 pregunta' : `${q.cantidadPreguntas} preguntas`}
                  </span>
                  {q.problemas > 0 && (
                    <Badge variant="destructive">{q.problemas === 1 ? '1 por completar' : `${q.problemas} por completar`}</Badge>
                  )}
                  <span className="ml-auto">Editado {haceCuanto(q.actualizadoEn)}</span>
                </div>
              </div>
            </Card>
          </motion.li>
        ))}
      </ul>
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

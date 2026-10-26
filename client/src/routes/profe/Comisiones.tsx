import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, EllipsisVertical, KeyRound, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { AlumnoPublico, Comision } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from './Confirmar';
import { useProfe } from './contexto';
import { DialogoAlumno, DialogoLote, DialogoTexto, type PedidoTexto } from './Dialogos';

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function Comisiones() {
  const { pedir, presencia } = useProfe();
  const [comisiones, setComisiones] = useState<Comision[] | null>(null);
  const [elegidaId, setElegidaId] = useState<number | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoPublico[] | null>(null);

  const [pedidoTexto, setPedidoTexto] = useState<PedidoTexto | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const [editando, setEditando] = useState<AlumnoPublico | null>(null);
  const [loteAbierto, setLoteAbierto] = useState(false);

  const elegida = comisiones?.find((c) => c.id === elegidaId) ?? null;

  const cargarComisiones = useCallback(async () => {
    const lista = await pedir<Comision[]>('/comisiones');
    setComisiones(lista);
    // Mantener la elegida; si no hay, abrir la primera que tenga alumnos.
    setElegidaId((id) =>
      lista.some((c) => c.id === id) ? id : ((lista.find((c) => c.cantidadAlumnos > 0) ?? lista[0])?.id ?? null),
    );
  }, [pedir]);

  const cargarAlumnos = useCallback(async () => {
    if (elegidaId === null) return setAlumnos(null);
    setAlumnos(await pedir<AlumnoPublico[]>(`/comisiones/${elegidaId}/alumnos`));
  }, [pedir, elegidaId]);

  useEffect(() => {
    cargarComisiones().catch((e) => toast.error(mensajeDe(e)));
  }, [cargarComisiones]);

  // Cuando alguien entra o sale puede haber creado su contraseña: refrescar la lista.
  useEffect(() => {
    cargarAlumnos().catch(() => {});
  }, [cargarAlumnos, presencia]);

  const conectados = new Set((elegidaId !== null ? presencia[elegidaId] : undefined)?.map((a) => a.id));

  // --- acciones ---------------------------------------------------------------

  const nuevaComision = () =>
    setPedidoTexto({
      titulo: 'Nueva comisión',
      descripcion: 'Por ejemplo, el día y horario: "Martes 14 h".',
      etiqueta: 'Nombre',
      accion: 'Crear comisión',
      max: 40,
      onGuardar: async (nombre) => {
        const c = await pedir<Comision>('/comisiones', { method: 'POST', body: { nombre } });
        await cargarComisiones();
        setElegidaId(c.id);
        toast.success(`Creaste la comisión ${c.nombre}`);
      },
    });

  const renombrar = (c: Comision) =>
    setPedidoTexto({
      titulo: 'Renombrar comisión',
      etiqueta: 'Nombre',
      inicial: c.nombre,
      accion: 'Guardar',
      max: 40,
      onGuardar: async (nombre) => {
        await pedir(`/comisiones/${c.id}`, { method: 'PATCH', body: { nombre } });
        await cargarComisiones();
      },
    });

  const borrarComision = (c: Comision) =>
    setConfirmacion({
      titulo: `¿Borrar la comisión ${c.nombre}?`,
      descripcion: `Se borran también sus ${plural(c.cantidadAlumnos, 'alumno', 'alumnos')} y todos sus resultados. No se puede deshacer.`,
      accion: 'Borrar comisión',
      destructiva: true,
      onConfirmar: async () => {
        await pedir(`/comisiones/${c.id}`, { method: 'DELETE' }).catch((e) => toast.error(mensajeDe(e)));
        await cargarComisiones();
      },
    });

  const agregarAlumno = (c: Comision) =>
    setPedidoTexto({
      titulo: 'Agregar alumno',
      descripcion: `A la comisión ${c.nombre}. El avatar se elige al azar y después lo podés cambiar.`,
      etiqueta: 'Nombre y apellido',
      accion: 'Agregar',
      onGuardar: async (nombre) => {
        await pedir(`/comisiones/${c.id}/alumnos`, { method: 'POST', body: { nombre } });
        await Promise.all([cargarAlumnos(), cargarComisiones()]);
      },
    });

  const pegarLista = async (texto: string) => {
    if (!elegida) return;
    const r = await pedir<{ agregados: string[]; repetidos: string[] }>(`/comisiones/${elegida.id}/alumnos/lote`, {
      method: 'POST',
      body: { texto },
    });
    await Promise.all([cargarAlumnos(), cargarComisiones()]);
    toast.success(`Agregaste ${plural(r.agregados.length, 'alumno', 'alumnos')}`, {
      description: r.repetidos.length > 0 ? `Ya estaban en la lista: ${r.repetidos.join(', ')}` : undefined,
    });
  };

  const guardarAlumno = async (cambios: { nombre: string; avatar: string }) => {
    if (!editando) return;
    await pedir(`/alumnos/${editando.id}`, { method: 'PATCH', body: cambios });
    await cargarAlumnos();
  };

  const restaurar = (a: AlumnoPublico) =>
    setConfirmacion({
      titulo: `¿Restaurar la contraseña de ${a.nombre}?`,
      descripcion: 'Se borra la actual y la próxima vez que entre va a crear una nueva. Si está conectado, se le cierra la sesión.',
      accion: 'Restaurar contraseña',
      onConfirmar: async () => {
        try {
          await pedir(`/alumnos/${a.id}/restaurar`, { method: 'POST' });
          await cargarAlumnos();
          toast.success(`${a.nombre} va a crear una contraseña nueva al entrar`);
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  const borrarAlumno = (a: AlumnoPublico) =>
    setConfirmacion({
      titulo: `¿Borrar a ${a.nombre}?`,
      descripcion: 'Se borran también sus respuestas y puntajes. No se puede deshacer.',
      accion: 'Borrar alumno',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(`/alumnos/${a.id}`, { method: 'DELETE' });
          await Promise.all([cargarAlumnos(), cargarComisiones()]);
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  // --- vista --------------------------------------------------------------------

  const dialogos = (
    <>
      <DialogoTexto pedido={pedidoTexto} onCerrar={() => setPedidoTexto(null)} />
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
      <DialogoAlumno alumno={editando} onCerrar={() => setEditando(null)} onGuardar={guardarAlumno} />
      <DialogoLote abierto={loteAbierto} comision={elegida?.nombre ?? ''} onCerrar={() => setLoteAbierto(false)} onGuardar={pegarLista} />
    </>
  );

  if (comisiones === null) {
    return (
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  if (comisiones.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>Creá tu primera comisión</EmptyTitle>
            <EmptyDescription>Después le cargás los alumnos, uno por uno o pegando la lista entera.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={nuevaComision}>
              <Plus data-icon="inline-start" />
              Nueva comisión
            </Button>
          </EmptyContent>
        </Empty>
        {dialogos}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Comisiones</CardTitle>
          <CardAction>
            <Button size="sm" variant="secondary" onClick={nuevaComision}>
              <Plus data-icon="inline-start" />
              Nueva
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1">
            {comisiones.map((c) => {
              const enLinea = presencia[c.id]?.length ?? 0;
              const activa = c.id === elegidaId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={activa || undefined}
                    onClick={() => setElegidaId(c.id)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-2xl px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                      activa && 'bg-secondary hover:bg-secondary',
                    )}
                  >
                    <span className="font-semibold">{c.nombre}</span>
                    <span className="text-sm text-muted-foreground">
                      {plural(c.cantidadAlumnos, 'alumno', 'alumnos')}
                      {enLinea > 0 && `, ${plural(enLinea, 'conectado', 'conectados')}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {elegida && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{elegida.nombre}</CardTitle>
            <CardDescription className="col-start-1">
              {plural(elegida.cantidadAlumnos, 'alumno', 'alumnos')}
              {conectados.size > 0 && `, ${plural(conectados.size, 'conectado ahora', 'conectados ahora')}`}
            </CardDescription>
            {/* En el celu, los botones van debajo del título (si no, se salen por el costado). */}
            <CardAction className="flex flex-wrap gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
              <Button variant="outline" onClick={() => setLoteAbierto(true)}>
                <ClipboardList data-icon="inline-start" />
                Pegar lista
              </Button>
              <Button onClick={() => agregarAlumno(elegida)}>
                <UserPlus data-icon="inline-start" />
                Agregar alumno
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Opciones de ${elegida.nombre}`}>
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => renombrar(elegida)}>
                      <Pencil />
                      Renombrar comisión
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" onSelect={() => borrarComision(elegida)}>
                      <Trash2 />
                      Borrar comisión
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          </CardHeader>
          <CardContent>
            {alumnos === null ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
              </div>
            ) : alumnos.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Esta comisión no tiene alumnos todavía</EmptyTitle>
                  <EmptyDescription>Lo más rápido es pegar la lista completa, uno por línea.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {alumnos.map((a) => (
                    <motion.li
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="flex items-center gap-3 border-b border-border/70 py-2 last:border-b-0"
                    >
                      <PinAvatar avatar={a.avatar} tamano={36} />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
                      {conectados.has(a.id) && (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="size-2 rounded-full bg-nivel-fuerte" aria-hidden />
                          <span className="max-sm:sr-only">Conectado</span>
                        </span>
                      )}
                      {!a.tienePassword && <Badge variant="secondary">Sin contraseña</Badge>}
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar a ${a.nombre}`} onClick={() => setEditando(a)}>
                        <Pencil />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Más opciones para ${a.nombre}`}>
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem disabled={!a.tienePassword} onSelect={() => restaurar(a)}>
                              <KeyRound />
                              Restaurar contraseña
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem variant="destructive" onSelect={() => borrarAlumno(a)}>
                              <Trash2 />
                              Borrar alumno
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {dialogos}
    </div>
  );
}

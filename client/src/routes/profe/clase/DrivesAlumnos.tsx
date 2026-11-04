import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eraser, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatoTamano, type ItemDrive, type MiDrive, type ResumenDriveAlumno } from '@aula/shared';
import { Drive } from '@/components/drive/Drive';
import { VistaPrevia } from '@/components/drive/Dialogos';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { CLAVES, leer } from '@/lib/almacen';
import { mensajeDe } from '@/lib/api';
import { urlArchivo } from '@/lib/drive';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';

/** El profe mira los Drives de una comisión: lo que le compartieron y, entrando a cada alumno, todo su Drive (sin tocar). */
export function DialogoDrives({
  abierto,
  onCerrar,
  comisionId,
  comisionNombre,
}: {
  abierto: boolean;
  onCerrar: () => void;
  comisionId: number;
  comisionNombre?: string;
}) {
  const { pedir, socket } = useProfe();
  const token = leer(CLAVES.tokenProfe) ?? '';
  const [resumen, setResumen] = useState<ResumenDriveAlumno[] | null>(null);
  const [alumno, setAlumno] = useState<ResumenDriveAlumno | null>(null);
  const [drive, setDrive] = useState<MiDrive | null>(null);
  const [previa, setPrevia] = useState<ItemDrive | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  const cargar = useCallback(async () => {
    try {
      setResumen(await pedir<ResumenDriveAlumno[]>(`/profe/drive/comision/${comisionId}`));
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  }, [pedir, comisionId]);

  const cargarAlumno = useCallback(
    async (id: number) => {
      try {
        setDrive(await pedir<MiDrive>(`/profe/drive/alumno/${id}`));
      } catch (e) {
        toast.error(mensajeDe(e));
      }
    },
    [pedir],
  );

  useEffect(() => {
    if (!abierto) {
      setAlumno(null);
      setDrive(null);
      return;
    }
    void cargar();
  }, [abierto, cargar]);

  // En vivo: si un alumno sube o comparte algo mientras está abierto, se actualiza.
  useEffect(() => {
    if (!abierto || !socket) return;
    const alCambio = (id: number) => {
      void cargar();
      if (alumno?.alumnoId === id) void cargarAlumno(id);
    };
    socket.on('drive:cambio', alCambio);
    return () => {
      socket.off('drive:cambio', alCambio);
    };
  }, [abierto, socket, cargar, cargarAlumno, alumno?.alumnoId]);

  const verAlumno = (a: ResumenDriveAlumno) => {
    setAlumno(a);
    setDrive(null);
    void cargarAlumno(a.alumnoId);
  };

  const vaciar = (a: ResumenDriveAlumno | null) =>
    setConfirmacion({
      titulo: a ? `¿Vaciar el Drive de ${a.nombre}?` : `¿Vaciar los Drives de toda la comisión ${comisionNombre ?? ''}?`,
      descripcion: 'Se borran para siempre todas sus carpetas y archivos. Las votaciones que ya se hicieron quedan guardadas.',
      accion: 'Vaciar',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(a ? `/profe/drive/alumno/${a.alumnoId}` : `/profe/drive/comision/${comisionId}`, { method: 'DELETE' });
          toast.success(a ? `Se vació el Drive de ${a.nombre}` : 'Se vaciaron los Drives');
          if (a) await cargarAlumno(a.alumnoId);
          await cargar();
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  const compartidos = (resumen ?? []).flatMap((a) => a.compartidos.map((item) => ({ item, a })));

  return (
    <>
      <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
        <DialogContent className="flex h-[min(52rem,calc(100dvh-2rem))] flex-col gap-4 sm:max-w-6xl">
          <DialogHeader className="flex-row items-center gap-2">
            {alumno && (
              <Button variant="ghost" size="icon-sm" aria-label="Volver a la lista" onClick={() => setAlumno(null)}>
                <ArrowLeft />
              </Button>
            )}
            <div className="flex flex-col gap-1">
              <DialogTitle>{alumno ? `Drive de ${alumno.nombre}` : `Drives de la comisión ${comisionNombre ?? ''}`}</DialogTitle>
              <DialogDescription>
                {alumno ? 'Podés mirar y descargar, pero no cambiar nada.' : 'Lo que te compartieron y cómo viene el Drive de cada uno.'}
              </DialogDescription>
            </div>
          </DialogHeader>

          {alumno ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring-1 ring-border">
              <Drive drive={drive} setDrive={setDrive} token={token} dueno={alumno} soloLectura />
            </div>
          ) : resumen === null ? (
            <Spinner />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
              <section className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 font-bold">
                  <Users className="size-5" />
                  Compartido con vos ({compartidos.length})
                </h3>
                {compartidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía nadie te compartió nada.</p>
                ) : (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
                    {compartidos.map(({ item, a }) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setPrevia(item)}
                          className="flex w-full flex-col overflow-hidden rounded-xl bg-muted text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <span className="grid aspect-[4/3] place-items-center overflow-hidden bg-card">
                            {item.mime?.startsWith('image/') ? (
                              <img src={urlArchivo(item.id, token)} alt="" loading="lazy" className="size-full object-cover" />
                            ) : (
                              <span className="px-2 text-center text-xs text-muted-foreground">{item.nombre}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 p-2">
                            <PinAvatar avatar={a.avatar} tamano={22} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-xs font-semibold">{a.nombre}</span>
                              <span className="truncate text-xs text-muted-foreground">{item.nombre}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">Alumnos</h3>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => vaciar(null)}>
                    <Eraser data-icon="inline-start" />
                    Vaciar todos
                  </Button>
                </div>
                <ul className="flex flex-col">
                  {resumen.map((a) => (
                    <li key={a.alumnoId} className="flex items-center gap-3 rounded-xl px-2 py-1.5 odd:bg-muted/50">
                      <PinAvatar avatar={a.avatar} tamano={30} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{a.nombre}</span>
                      <span className="hidden text-sm text-muted-foreground sm:block">
                        {a.archivos} {a.archivos === 1 ? 'archivo' : 'archivos'}, {a.carpetas} {a.carpetas === 1 ? 'carpeta' : 'carpetas'},{' '}
                        {formatoTamano(a.usados)}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => verAlumno(a)}>
                        Ver su Drive
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Vaciar el Drive de ${a.nombre}`} onClick={() => vaciar(a)}>
                        <Eraser />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <VistaPrevia item={previa} token={token} onCerrar={() => setPrevia(null)} />
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </>
  );
}

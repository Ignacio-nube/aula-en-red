import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { AlumnoPublico } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SocketAula } from '@/lib/socket';
import type { EstadoDe } from '../tipos';
import { entregarProyecto, horaCorta, URL_EDITOR, useEditorScratch, type VmScratch } from './editor';

interface Props {
  estado: EstadoDe<'scratch'>;
  recibido: number;
  socket: SocketAula | null;
  alumno: AlumnoPublico;
  token: string;
}

export function AlumnoScratch({ estado, token }: Props) {
  const v = estado.vista;
  // Se elige una sola vez, al abrir: si ya había entregado (y recargó la página), sigue desde su entrega.
  // Cuando entrega, no se recarga: lo que tiene en el editor ya es lo entregado.
  const [proyecto] = useState(() => v.miEntrega?.url ?? v.inicialUrl);
  const [cambios, setCambios] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [vmListo, setVmListo] = useState<VmScratch | null>(null);
  const { iframe, estado: editor } = useEditorScratch(proyecto, setVmListo);

  // Cualquier cambio en el proyecto (bloques, disfraces, sonidos) lo marca sin entregar.
  useEffect(() => {
    if (!vmListo) return;
    const alCambiar = () => setCambios(true);
    // La carga misma avisa un cambio: se empieza a escuchar un rato después.
    const t = setTimeout(() => vmListo.on('PROJECT_CHANGED', alCambiar), 500);
    return () => {
      clearTimeout(t);
      vmListo.off('PROJECT_CHANGED', alCambiar);
    };
  }, [vmListo]);

  // Si cierra o recarga la pestaña con cambios sin entregar, el navegador pregunta.
  useEffect(() => {
    if (!cambios) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [cambios]);

  const entregar = async () => {
    if (editor.fase !== 'listo') return;
    setEntregando(true);
    try {
      await entregarProyecto(editor.vm, token);
      setCambios(false);
      toast.success('¡Entregado! Si seguís cambiando cosas, podés volver a entregar.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo entregar. Probá de nuevo.');
    } finally {
      setEntregando(false);
    }
  };

  const mia = v.miEntrega;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <p className="min-w-0 truncate font-bold">{v.titulo}</p>
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm font-medium" role="status">
            {mia && !cambios ? (
              <>
                <CircleCheck className="size-4 text-pd-resp-d" />
                Entregado a las {horaCorta(mia.entregadaEn)}
              </>
            ) : mia ? (
              <>
                <CircleAlert className="size-4 text-amber-500" />
                Tenés cambios sin entregar
              </>
            ) : (
              <span className="text-muted-foreground">Todavía no entregaste</span>
            )}
          </p>
          <Button disabled={editor.fase !== 'listo' || entregando} onClick={() => void entregar()}>
            {entregando ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
            {mia ? 'Entregar de nuevo' : 'Entregar'}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-card shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-border">
        <iframe ref={iframe} src={URL_EDITOR} title="Editor de Scratch" className="size-full border-0" allow="microphone; camera" />
        {editor.fase !== 'listo' && (
          <div className="absolute inset-0 grid place-items-center bg-card/90">
            {editor.fase === 'cargando' ? (
              <p className="flex items-center gap-2 font-semibold">
                <Spinner /> Abriendo el editor de Scratch…
              </p>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <CircleAlert className="size-8 text-destructive" />
                <p className="font-semibold">{editor.mensaje}</p>
                <Button variant="outline" onClick={() => location.reload()}>
                  Volver a intentar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

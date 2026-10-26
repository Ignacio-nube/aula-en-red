import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MonitorPlay, Square } from 'lucide-react';
import { toast } from 'sonner';
import type { EstadoPresentacion } from '@aula/shared';
import { Diapositiva, Miniatura } from '@/components/pd/Diapositiva';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
import { urlPresentacion, useDocumentoPdf } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';

export function ControlPresentacion({ estado: e }: { estado: EstadoPresentacion }) {
  const { controlarPresentacion, presencia } = useProfe();
  const url = urlPresentacion(e.archivo);
  const { doc, error } = useDocumentoPdf(url);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const tira = useRef<HTMLOListElement>(null);

  // Página a la que se quiere ir: si se aprietan varias flechas seguidas, cuentan todas aunque el
  // servidor todavía no haya confirmado la anterior.
  const objetivo = useRef(e.pagina);
  const confirmada = useRef(e.pagina);
  useEffect(() => {
    objetivo.current = e.pagina;
    confirmada.current = e.pagina;
  }, [e.pagina]);

  const ir = useCallback(
    async (pagina: number) => {
      const nueva = Math.min(Math.max(pagina, 1), e.paginas);
      if (nueva === objetivo.current) return;
      objetivo.current = nueva;
      const r = await controlarPresentacion({ tipo: 'ir', pagina: nueva });
      if (!r.ok) {
        // No llegó (por ejemplo, sin conexión): la próxima flecha cuenta desde la que se ve.
        objetivo.current = confirmada.current;
        toast.error(r.error);
      }
    },
    [controlarPresentacion, e.paginas],
  );

  // Flechas, Av Pág / Re Pág y barra espaciadora: también funcionan con un presentador inalámbrico.
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="dialog"], [role="menu"], [contenteditable]')) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const destino: Record<string, number> = {
        ArrowRight: objetivo.current + 1,
        PageDown: objetivo.current + 1,
        ' ': objetivo.current + 1,
        ArrowLeft: objetivo.current - 1,
        PageUp: objetivo.current - 1,
        Home: 1,
        End: e.paginas,
      };
      if (!(ev.key in destino)) return;
      ev.preventDefault();
      void ir(destino[ev.key]!);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [ir, e.paginas]);

  // En el celu, el control remoto ocupa lugar abajo: la fila de manos se ubica encima.
  useEffect(() => {
    document.documentElement.style.setProperty('--extra-abajo', '4.5rem');
    return () => void document.documentElement.style.removeProperty('--extra-abajo');
  }, []);

  // La miniatura actual siempre a la vista.
  useEffect(() => {
    tira.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [e.pagina]);

  const cambiarLibre = async (activo: boolean) => {
    const r = await controlarPresentacion({ tipo: 'libre', activo });
    if (!r.ok) toast.error(r.error);
  };

  const terminar = () =>
    setConfirmacion({
      titulo: '¿Terminar la presentación?',
      descripcion: 'Los alumnos y la pantalla grande vuelven a la sala de espera.',
      accion: 'Terminar',
      onConfirmar: async () => {
        const r = await controlarPresentacion({ tipo: 'terminar' });
        if (!r.ok) toast.error(r.error);
      },
    });

  const conectados = presencia[e.comisionId]?.length ?? 0;
  const paginas = Array.from({ length: e.paginas }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge>Presentando</Badge>
          <h2 className="min-w-0 truncate text-xl font-bold">{e.titulo}</h2>
          <span className="text-sm text-muted-foreground">
            Comisión {e.comisionNombre}, {conectados === 1 ? '1 conectado' : `${conectados} conectados`}
          </span>
        </div>

        {/* El alto sale de la ventana: en 1366 × 768 entran la diapositiva y la tira sin scroll. */}
        <div className="relative aspect-video rounded-3xl bg-muted/70 p-2 sm:p-3 lg:aspect-auto lg:h-[max(16rem,calc(100dvh-var(--alto-barra,4rem)-15.5rem))]">
          {error ? (
            <p className="grid h-full place-items-center text-muted-foreground">No se pudo abrir el PDF.</p>
          ) : (
            <Diapositiva
              doc={doc}
              url={url}
              pagina={e.pagina}
              precargar={[e.pagina + 1, e.pagina + 2, e.pagina - 1]}
              claseMarco="rounded-xl shadow-[var(--pd-sombra-flotante)]"
            />
          )}
          <Button
            variant="outline"
            size="icon-lg"
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full shadow-[var(--pd-sombra-tarjeta)]"
            aria-label="Diapositiva anterior"
            disabled={e.pagina <= 1}
            onClick={() => void ir(e.pagina - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-lg"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full"
            aria-label="Diapositiva siguiente"
            disabled={e.pagina >= e.paginas}
            onClick={() => void ir(e.pagina + 1)}
          >
            <ChevronRight />
          </Button>
        </div>

        <ol ref={tira} className="flex gap-2 overflow-x-auto px-1 pt-1 pb-2" aria-label="Diapositivas">
          {paginas.map((n) => (
            <li key={n} className="flex-none">
              <button
                type="button"
                aria-current={n === e.pagina}
                aria-label={`Ir a la diapositiva ${n}`}
                onClick={() => void ir(n)}
                className={cn(
                  'relative flex h-[4.5rem] w-32 rounded-xl bg-muted p-1 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50',
                  n === e.pagina ? 'ring-3 ring-pd-celeste' : 'ring-1 ring-border hover:ring-pd-celeste/60',
                )}
              >
                <Miniatura doc={doc} url={url} pagina={n} claseMarco="rounded-sm" />
                <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 text-xs font-semibold text-white tabular-nums">
                  {n}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-4">
        <Card size="sm" className="max-lg:hidden">
          <CardHeader>
            <CardDescription>Diapositiva</CardDescription>
            <p className="text-3xl font-bold tabular-nums">
              {e.pagina} <span className="text-lg font-medium text-muted-foreground">de {e.paginas}</span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={e.pagina <= 1} onClick={() => void ir(e.pagina - 1)}>
                <ChevronLeft data-icon="inline-start" />
                Anterior
              </Button>
              <Button disabled={e.pagina >= e.paginas} onClick={() => void ir(e.pagina + 1)}>
                Siguiente
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              También con <Kbd>←</Kbd> <Kbd>→</Kbd> o un presentador inalámbrico.
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>{e.pagina < e.paginas ? 'Después viene' : 'Es la última diapositiva'}</CardDescription>
          </CardHeader>
          {e.pagina < e.paginas && (
            <CardContent>
              <div className="h-32 rounded-xl bg-muted p-1.5">
                <Diapositiva doc={doc} url={url} pagina={e.pagina + 1} claseMarco="rounded-md" etiqueta="Diapositiva siguiente" />
              </div>
            </CardContent>
          )}
        </Card>

        <Card size="sm">
          <CardContent className="flex flex-col gap-4">
            <Field orientation="horizontal">
              <Switch id="modo-libre" checked={e.libre} onCheckedChange={(v) => void cambiarLibre(v)} />
              <FieldContent>
                <FieldLabel htmlFor="modo-libre">Modo libre</FieldLabel>
                <FieldDescription>Los alumnos pueden ir y volver por su cuenta. Tienen un botón para volver a donde estás vos.</FieldDescription>
              </FieldContent>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
                <MonitorPlay data-icon="inline-start" />
                Pantalla grande
              </Button>
              <Button variant="destructive" size="sm" onClick={terminar}>
                <Square data-icon="inline-start" />
                Terminar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Celu o tablet: control remoto con botones grandes, arriba de la barra de pestañas. */}
      <div className="vidrio fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-full p-1.5 shadow-[var(--pd-sombra-flotante)] ring-1 ring-foreground/5 lg:hidden">
        <Button variant="outline" size="lg" className="flex-1" disabled={e.pagina <= 1} onClick={() => void ir(e.pagina - 1)}>
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>
        <span className="min-w-16 text-center text-lg font-bold tabular-nums">
          {e.pagina}/{e.paginas}
        </span>
        <Button size="lg" className="flex-1" disabled={e.pagina >= e.paginas} onClick={() => void ir(e.pagina + 1)}>
          Siguiente
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>

      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

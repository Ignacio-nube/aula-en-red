import { useState } from 'react';
import { Download, EyeOff, MonitorPlay, MonitorUp, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionScratch } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CLAVES, leer } from '@/lib/almacen';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '@/routes/profe/Confirmar';
import { useProfe } from '@/routes/profe/contexto';
import type { EstadoDe } from '../tipos';
import { horaCorta } from './editor';

const tamano = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function ControlScratch({ estado }: { estado: EstadoDe<'scratch'>; recibido: number }) {
  const { controlarActividad } = useProfe();
  const token = leer(CLAVES.tokenProfe) ?? '';
  const v = estado.vista;
  const [ocupado, setOcupado] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  const accion = async (a: AccionScratch) => {
    setOcupado(true);
    const r = await controlarActividad({ tipo: 'accion', accion: a });
    setOcupado(false);
    if (!r.ok) toast.error(r.error);
  };
  const terminar = () =>
    setConfirmacion({
      titulo: '¿Terminar el taller?',
      descripcion:
        v.entregaron < v.total
          ? `Faltan ${v.total - v.entregaron} por entregar: lo que no entregaron se pierde. Las entregas quedan guardadas en la compu.`
          : 'Las entregas quedan guardadas en la compu (server/data/scratch).',
      accion: 'Terminar',
      destructiva: v.entregaron < v.total,
      onConfirmar: () =>
        void controlarActividad({ tipo: 'cerrar' }).then((r) => {
          if (!r.ok) toast.error(r.error);
        }),
    });

  // Primero los que ya entregaron (lo último arriba), después los que faltan.
  const lista = [...v.entregas].sort((a, b) => (b.entregadaEn ?? '').localeCompare(a.entregadaEn ?? '') || a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge>En curso</Badge>
          Taller de Scratch, comisión {estado.comisionNombre}
          {v.inicialNombre && <span>· arrancan con «{v.inicialNombre}»</span>}
        </CardDescription>
        <CardTitle className="text-2xl">{v.titulo}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
            <MonitorPlay data-icon="inline-start" />
            Pantalla grande
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="font-semibold">
          Entregaron {v.entregaron} de {v.total}
        </p>
        <ul className="flex flex-col divide-y divide-border rounded-2xl ring-1 ring-border" aria-label="Entregas">
          {lista.map((e) => {
            const enPantalla = v.mostrando?.alumnoId === e.alumnoId;
            return (
              <li key={e.alumnoId} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2', enPantalla && 'bg-pd-celeste-claro dark:bg-pd-celeste-oscuro/25')}>
                <span className="relative">
                  <PinAvatar avatar={e.avatar} tamano={30} />
                  <span
                    className={cn('absolute -right-0.5 bottom-0 size-2.5 rounded-full ring-2 ring-card', e.conectado ? 'bg-pd-resp-d' : 'bg-muted-foreground/40')}
                    title={e.conectado ? 'Conectado' : 'Desconectado'}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.nombre}</span>
                {e.entregadaEn ? (
                  <>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Entregó a las {horaCorta(e.entregadaEn)}
                      {e.veces > 1 && ` (${e.veces} veces)`} · {tamano(e.bytes)}
                    </span>
                    <span className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/api/scratch/entregas/${e.alumnoId}/descargar?t=${encodeURIComponent(token)}`} download aria-label={`Descargar el proyecto de ${e.nombre}`}>
                          <Download data-icon="inline-start" />
                          Descargar
                        </a>
                      </Button>
                      <Button
                        variant={enPantalla ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void accion(enPantalla ? { tipo: 'ocultar' } : { tipo: 'mostrar', alumnoId: e.alumnoId })}
                      >
                        {enPantalla ? <EyeOff data-icon="inline-start" /> : <MonitorUp data-icon="inline-start" />}
                        {enPantalla ? 'Sacar de la pantalla' : 'Mostrar en pantalla'}
                      </Button>
                    </span>
                  </>
                ) : (
                  <Badge variant="outline">Todavía no entregó</Badge>
                )}
              </li>
            );
          })}
          {lista.length === 0 && <li className="p-3 text-muted-foreground">Esta comisión no tiene alumnos.</li>}
        </ul>
      </CardContent>

      <CardFooter className="flex-wrap justify-end gap-3 border-t-0 bg-transparent">
        {v.mostrando && (
          <Button variant="outline" disabled={ocupado} onClick={() => void accion({ tipo: 'ocultar' })}>
            <EyeOff data-icon="inline-start" />
            Volver a la lista en la pantalla
          </Button>
        )}
        <Button variant="ghost" onClick={terminar}>
          <X data-icon="inline-start" />
          Terminar el taller
        </Button>
      </CardFooter>
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </Card>
  );
}

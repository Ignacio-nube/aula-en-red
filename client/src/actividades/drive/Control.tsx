import { useState } from 'react';
import { Check, MonitorPlay, RotateCcw, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionMisiones } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ordinal } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { useProfe } from '@/routes/profe/contexto';
import { DialogoDrives } from '@/routes/profe/clase/DrivesAlumnos';
import type { EstadoDe } from '../tipos';

export function ControlMisiones({ estado }: { estado: EstadoDe<'drive'>; recibido: number }) {
  const { controlarActividad } = useProfe();
  const v = estado.vista;
  const [ocupado, setOcupado] = useState(false);
  const [viendoDrives, setViendoDrives] = useState(false);

  const accion = async (a: AccionMisiones) => {
    setOcupado(true);
    const r = await controlarActividad({ tipo: 'accion', accion: a });
    setOcupado(false);
    if (!r.ok) toast.error(r.error);
  };
  const cerrar = async () => {
    const r = await controlarActividad({ tipo: 'cerrar' });
    if (!r.ok) toast.error(r.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant={v.fase === 'curso' ? 'default' : 'secondary'}>{v.fase === 'curso' ? 'En curso' : 'Terminadas'}</Badge>
          Misiones en Drive, comisión {estado.comisionNombre}
        </CardDescription>
        <CardTitle className="text-2xl">{v.titulo}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
            <MonitorPlay data-icon="inline-start" />
            Pantalla grande
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {v.participantes === 0 ? 'Esperando que entren los alumnos…' : `${v.completaron} de ${v.participantes} completaron todas las misiones.`}
        </p>
        <ol className="flex flex-col gap-1 text-sm">
          {v.pasos.map((p, i) => {
            const n = v.alumnos.filter((a) => a.hechos[i]).length;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">{p}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {n}/{v.participantes}
                </span>
              </li>
            );
          })}
        </ol>

        {v.alumnos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Alumno</th>
                  {v.pasos.map((p, i) => (
                    <th key={i} className="w-10 px-1 py-1 text-center font-medium" title={p}>
                      {i + 1}
                    </th>
                  ))}
                  <th className="w-16 py-1 pl-2 text-right font-medium">Puesto</th>
                </tr>
              </thead>
              <tbody>
                {v.alumnos.map((a) => (
                  <tr key={a.alumnoId} className={cn('odd:bg-muted/50', !a.conectado && 'opacity-50')}>
                    <td className="rounded-l-xl py-1.5 pr-3 pl-2">
                      <span className="flex items-center gap-2">
                        <PinAvatar avatar={a.avatar} tamano={26} />
                        <span className="truncate font-semibold">{a.nombre}</span>
                      </span>
                    </td>
                    {a.hechos.map((h, i) => (
                      <td key={i} className="px-1 text-center">
                        {h ? (
                          <Check className="mx-auto size-5 text-bien-texto" strokeWidth={3} aria-label="Hecha" />
                        ) : (
                          <span className="mx-auto block size-2 rounded-full bg-foreground/20" aria-label="Falta" />
                        )}
                      </td>
                    ))}
                    <td className="rounded-r-xl pr-2 text-right font-bold tabular-nums">{a.puesto ? ordinal(a.puesto) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-wrap justify-end gap-3 border-t-0 bg-transparent">
        <Button variant="ghost" onClick={() => void cerrar()}>
          <X data-icon="inline-start" />
          {v.fase === 'fin' ? 'Cerrar' : 'Salir'}
        </Button>
        <Button variant="outline" onClick={() => setViendoDrives(true)}>
          Ver los Drives
        </Button>
        {v.fase === 'curso' ? (
          <Button size="lg" variant="destructive" disabled={ocupado} onClick={() => void accion({ tipo: 'terminar' })}>
            {ocupado ? <Spinner data-icon="inline-start" /> : <Square data-icon="inline-start" />}
            Terminar las misiones
          </Button>
        ) : (
          <Button size="lg" variant="outline" disabled={ocupado} onClick={() => void accion({ tipo: 'reabrir' })}>
            <RotateCcw data-icon="inline-start" />
            Seguir un rato más
          </Button>
        )}
      </CardFooter>
      <DialogoDrives abierto={viendoDrives} onCerrar={() => setViendoDrives(false)} comisionId={estado.comisionId} comisionNombre={estado.comisionNombre} />
    </Card>
  );
}

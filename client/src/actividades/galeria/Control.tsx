import { useEffect, useState } from 'react';
import { ChevronRight, Eye, MonitorPlay, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionGaleria } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Confirmar, type PedidoConfirmacion } from '@/routes/profe/Confirmar';
import { useProfe } from '@/routes/profe/contexto';
import type { EstadoDe } from '../tipos';
import { BarrasCaritas } from './Pantalla';

const FASE = { votando: 'Votando', revelada: 'Votos a la vista', podio: 'Podio' } as const;

export function ControlGaleria({ estado }: { estado: EstadoDe<'galeria'>; recibido: number }) {
  const { controlarActividad } = useProfe();
  const v = estado.vista;
  const [ocupado, setOcupado] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const ultimo = v.indice >= v.total - 1;

  const accion = async (a: AccionGaleria) => {
    setOcupado(true);
    const r = await controlarActividad({ tipo: 'accion', accion: a });
    setOcupado(false);
    if (!r.ok) toast.error(r.error);
  };
  const cerrar = async () => {
    const r = await controlarActividad({ tipo: 'cerrar' });
    if (!r.ok) toast.error(r.error);
  };
  const avanzar = () => {
    if (v.fase === 'votando') void accion({ tipo: 'revelar' });
    else if (v.fase === 'revelada') void accion({ tipo: 'siguiente' });
  };

  // Flecha derecha, AvPág o espacio: el paso que sigue (sirve con un presentador).
  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).closest('input, textarea, select, [role="dialog"], [contenteditable]')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') {
        ev.preventDefault();
        avanzar();
      }
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  const salir = () =>
    v.fase === 'podio'
      ? void cerrar()
      : setConfirmacion({
          titulo: '¿Salir de la votación?',
          descripcion: 'Los votos que ya se hicieron quedan guardados, pero no se va a ver el podio.',
          accion: 'Salir',
          destructiva: true,
          onConfirmar: () => void cerrar(),
        });

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant={v.fase === 'votando' ? 'default' : 'secondary'}>{FASE[v.fase]}</Badge>
          Votación de dibujos, comisión {estado.comisionNombre}
        </CardDescription>
        <CardTitle className="text-2xl">{v.titulo}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
            <MonitorPlay data-icon="inline-start" />
            Pantalla grande
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {v.fase === 'podio' ? (
          <ol className="flex flex-col gap-2">
            {v.podio.map((p) => (
              <li key={p.imagenId} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2">
                <span className="text-3xl">{['🥇', '🥈', '🥉'][p.puesto - 1]}</span>
                <img src={p.url} alt="" className="size-16 rounded-xl bg-card object-cover" />
                <span className="flex min-w-0 flex-1 flex-col">
                  {p.autor && (
                    <span className="flex items-center gap-2 font-semibold">
                      <PinAvatar avatar={p.autor.avatar} tamano={22} />
                      <span className="truncate">{p.autor.nombre}</span>
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {p.promedio.toLocaleString('es-AR')} de 5, {p.votos} {p.votos === 1 ? 'voto' : 'votos'}
                  </span>
                </span>
              </li>
            ))}
            {v.podio.length === 0 && <p className="text-muted-foreground">Nadie votó.</p>}
          </ol>
        ) : (
          v.imagen && (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <img src={v.imagen.url} alt="" className="max-h-72 w-full rounded-2xl bg-muted object-contain" />
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Dibujo {v.indice + 1} de {v.total}, de
                  </span>
                  {v.imagen.autor && (
                    <>
                      <PinAvatar avatar={v.imagen.autor.avatar} tamano={22} />
                      <span className="font-semibold">{v.imagen.autor.nombre}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-semibold">
                  Votaron {v.votaron} de {v.pueden}
                  {v.fase === 'votando' && <span className="font-normal text-muted-foreground"> (en la pantalla grande todavía no se ven los votos)</span>}
                </p>
                {v.resultados && <BarrasCaritas resultados={v.resultados} promedio={v.promedio} compacto />}
              </div>
            </div>
          )
        )}
      </CardContent>

      <CardFooter className="flex-wrap justify-end gap-3 border-t-0 bg-transparent">
        <Button variant="ghost" onClick={salir}>
          <X data-icon="inline-start" />
          {v.fase === 'podio' ? 'Cerrar' : 'Salir'}
        </Button>
        {v.fase !== 'podio' && !ultimo && (
          <Button variant="outline" disabled={ocupado} onClick={() => void accion({ tipo: 'podio' })}>
            <Trophy data-icon="inline-start" />
            Ir al podio
          </Button>
        )}
        {v.fase === 'votando' && (
          <Button size="lg" disabled={ocupado} onClick={() => void accion({ tipo: 'revelar' })}>
            {ocupado ? <Spinner data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            Mostrar los votos
          </Button>
        )}
        {v.fase === 'revelada' && (
          <Button size="lg" disabled={ocupado} onClick={() => void accion({ tipo: 'siguiente' })}>
            {ocupado ? <Spinner data-icon="inline-start" /> : ultimo ? <Trophy data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
            {ultimo ? 'Ver el podio' : 'Siguiente dibujo'}
          </Button>
        )}
      </CardFooter>
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </Card>
  );
}

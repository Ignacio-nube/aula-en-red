import { useEffect, useState } from 'react';
import { Flag, MonitorPlay, Play, RotateCcw, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionTipeo, CorredorTipeo, OpcionesTipeo } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { formatoReloj, useCuentaAtras } from '@/lib/actividad';
import { ordinal } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '@/routes/profe/Confirmar';
import { useProfe } from '@/routes/profe/contexto';
import type { EstadoDe } from '../tipos';
import { OpcionesCarrera, useTextosTipeo } from './Preparar';

const NOMBRE_FASE = { sala: 'Sala de espera', cuenta: 'Cuenta regresiva', carrera: 'Tipeando', fin: 'Resultados' } as const;

export function ControlTipeo({ estado, recibido }: { estado: EstadoDe<'tipeo'>; recibido: number }) {
  const { controlarActividad, irA } = useProfe();
  const v = estado.vista;
  const restante = useCuentaAtras(v.restanteMs, recibido, 250);
  const [ocupado, setOcupado] = useState(false);
  const [otraVuelta, setOtraVuelta] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

  const accion = async (a: AccionTipeo) => {
    setOcupado(true);
    const r = await controlarActividad({ tipo: 'accion', accion: a });
    setOcupado(false);
    if (!r.ok) toast.error(r.error);
    return r.ok;
  };
  const cerrar = async () => {
    const r = await controlarActividad({ tipo: 'cerrar' });
    if (!r.ok) toast.error(r.error);
  };

  // Flecha derecha o barra espaciadora: empezar (como en el quiz, sirve con un presentador).
  useEffect(() => {
    if (v.fase !== 'sala') return;
    const teclas = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).closest('input, textarea, select, [role="dialog"], [contenteditable]')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') {
        ev.preventDefault();
        void accion({ tipo: 'empezar' });
      }
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.fase]);

  const salir = () =>
    v.fase === 'fin' || v.fase === 'sala'
      ? void cerrar()
      : setConfirmacion({
          titulo: '¿Cortar la carrera y salir?',
          descripcion: 'Se guarda lo que llegó a tipear cada uno.',
          accion: 'Cortar y salir',
          destructiva: true,
          onConfirmar: async () => {
            if (await accion({ tipo: 'terminar' })) await cerrar();
          },
        });

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant={v.fase === 'carrera' ? 'default' : 'secondary'}>{NOMBRE_FASE[v.fase]}</Badge>
          Carrera de tipeo, comisión {estado.comisionNombre}
          {v.facil && <Badge variant="outline">Modo fácil</Badge>}
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
        {v.fase === 'sala' && (
          <div className="flex flex-col gap-3 rounded-3xl bg-pd-celeste-claro/60 p-5">
            <p className="font-semibold">
              {v.participantes === 0
                ? 'Esperando que entren los alumnos…'
                : `${v.participantes === 1 ? 'Está 1 alumno' : `Están ${v.participantes} alumnos`} con el texto en pantalla. Cuando estén listos, empezá.`}
            </p>
            <ul className="flex flex-wrap gap-2">
              {v.corredores.map((c) => (
                <li key={c.alumnoId} className="flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1">
                  <PinAvatar avatar={c.avatar} tamano={28} />
                  <span className="text-sm font-medium">{c.nombre}</span>
                </li>
              ))}
            </ul>
            <p className="line-clamp-3 text-sm text-muted-foreground">{v.texto}</p>
          </div>
        )}

        {v.fase === 'cuenta' && (
          <p className="rounded-3xl bg-pd-celeste-claro/60 p-6 text-center text-xl font-bold">Arranca en {Math.max(1, Math.ceil((restante ?? 0) / 1000))}…</p>
        )}

        {(v.fase === 'carrera' || v.fase === 'fin') && (
          <>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-muted-foreground">
              <span>
                {v.terminaron} de {v.participantes} terminaron
              </span>
              {v.fase === 'carrera' && restante !== null && <span className="tabular-nums">Quedan {formatoReloj(restante)}</span>}
            </p>
            <ListaCorredores corredores={v.corredores} largo={v.texto.length} enCurso={v.fase === 'carrera'} transcurridoMs={v.transcurridoMs} />
          </>
        )}
      </CardContent>

      <CardFooter className="flex-wrap justify-end gap-3 border-t-0 bg-transparent">
        <Button variant="ghost" onClick={salir}>
          <X data-icon="inline-start" />
          {v.fase === 'fin' ? 'Cerrar' : 'Salir'}
        </Button>
        {v.fase === 'fin' && (
          <Button variant="outline" onClick={() => irA('resultados')}>
            Ver el historial
          </Button>
        )}
        {v.fase === 'sala' && (
          <Button size="lg" disabled={ocupado || v.participantes === 0} onClick={() => void accion({ tipo: 'empezar' })}>
            {ocupado ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            Empezar la carrera
          </Button>
        )}
        {v.fase === 'cuenta' && (
          <Button variant="outline" disabled={ocupado} onClick={() => void accion({ tipo: 'terminar' })}>
            Cancelar
          </Button>
        )}
        {v.fase === 'carrera' && (
          <Button size="lg" variant="destructive" disabled={ocupado} onClick={() => void accion({ tipo: 'terminar' })}>
            <Square data-icon="inline-start" />
            Terminar la carrera
          </Button>
        )}
        {(v.fase === 'fin' || v.fase === 'sala') && (
          <Button size={v.fase === 'fin' ? 'lg' : 'default'} variant={v.fase === 'fin' ? 'default' : 'outline'} onClick={() => setOtraVuelta(true)}>
            <RotateCcw data-icon="inline-start" />
            {v.fase === 'fin' ? 'Otra vuelta' : 'Cambiar el texto'}
          </Button>
        )}
      </CardFooter>

      <DialogoOtraVuelta
        abierto={otraVuelta}
        inicial={{ textoId: v.textoId, facil: v.facil, limiteSeg: v.limiteSeg }}
        onCerrar={() => setOtraVuelta(false)}
        onAceptar={async (opciones) => {
          if (await accion({ tipo: 'otraVuelta', opciones })) setOtraVuelta(false);
        }}
      />
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </Card>
  );
}

/** Cómo va cada uno: puesto, avance, ppm y precisión. También la usa la pregunta de tipeo del quiz. */
export function ListaCorredores({
  corredores,
  largo,
  enCurso,
  transcurridoMs,
}: {
  corredores: CorredorTipeo[];
  largo: number;
  enCurso: boolean;
  transcurridoMs: number;
}) {
  return (
    <>
      <ol className="flex flex-col gap-1.5">
        {corredores.map((c) => {
          const avance = largo ? c.posicion / largo : 0;
          // Trabado: casi sin precisión o muy lento mientras los demás avanzan.
          const trabado = enCurso && !c.terminado && transcurridoMs > 20_000 && (c.precision < 70 || c.ppm < 5);
          return (
            <li
              key={c.alumnoId}
              className={cn(
                'grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2 py-1.5 odd:bg-muted/50 sm:grid-cols-[2rem_auto_minmax(0,12rem)_minmax(0,1fr)_auto]',
                !c.conectado && 'opacity-50',
              )}
            >
              <span className="text-right text-sm font-bold text-muted-foreground tabular-nums">{ordinal(c.puesto)}</span>
              <PinAvatar avatar={c.avatar} tamano={28} />
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{c.nombre}</span>
                {c.terminado && <Flag className="size-4 shrink-0 text-bien-texto" aria-label="Terminó" />}
                {trabado && <Badge variant="outline">Necesita ayuda</Badge>}
              </span>
              <Progress value={avance * 100} className="hidden sm:block" aria-label={`Avance de ${c.nombre}`} />
              <span className="text-right text-sm whitespace-nowrap tabular-nums">
                <span className="font-bold">{c.ppm}</span> ppm, {c.precision}%
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">ppm: palabras por minuto. El porcentaje es la precisión (teclas bien sobre el total).</p>
    </>
  );
}

function DialogoOtraVuelta({
  abierto,
  inicial,
  onCerrar,
  onAceptar,
}: {
  abierto: boolean;
  inicial: OpcionesTipeo;
  onCerrar: () => void;
  onAceptar: (o: OpcionesTipeo) => Promise<void>;
}) {
  const { textos, cargar } = useTextosTipeo();
  const [opciones, setOpciones] = useState(inicial);
  useEffect(() => {
    if (!abierto) return;
    setOpciones(inicial);
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Otra vuelta</DialogTitle>
          <DialogDescription>Con el mismo texto para ver si mejoran, o con otro.</DialogDescription>
        </DialogHeader>
        {textos ? <OpcionesCarrera valor={opciones} onCambiar={setOpciones} textos={textos} /> : <Spinner />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={() => void onAceptar(opciones)}>
            <RotateCcw data-icon="inline-start" />
            Volver a la sala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

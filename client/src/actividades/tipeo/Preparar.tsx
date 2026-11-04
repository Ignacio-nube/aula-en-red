import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Keyboard, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LETRAS_POR_PALABRA, LIMITES_TIEMPO_TIPEO, LIMITES_TIPEO, normalizarTexto, type OpcionesTipeo, type TextoTipeo } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '@/routes/profe/Confirmar';
import { BarraEmpezar } from '@/routes/profe/clase/BarraEmpezar';
import { useProfe } from '@/routes/profe/contexto';
import type { PropsPreparar } from '../tipos';

const NOMBRE_LIMITE = (s: number | null) => (s === null ? 'Sin límite' : `${s / 60} min`);
const palabras = (t: string) => Math.round(t.length / LETRAS_POR_PALABRA);

/** Hook con la lista de textos (la usan Preparar y "Otra vuelta"). */
export function useTextosTipeo() {
  const { pedir } = useProfe();
  const [textos, setTextos] = useState<TextoTipeo[] | null>(null);
  const cargar = useCallback(async () => {
    try {
      setTextos(await pedir<TextoTipeo[]>('/tipeo/textos'));
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  }, [pedir]);
  useEffect(() => void cargar(), [cargar]);
  return { textos, cargar };
}

/** Opciones de la carrera: texto, modo fácil y tiempo límite. */
export function OpcionesCarrera({
  valor,
  onCambiar,
  textos,
  onEditar,
}: {
  valor: OpcionesTipeo;
  onCambiar: (o: OpcionesTipeo) => void;
  textos: TextoTipeo[];
  onEditar?: (t: TextoTipeo) => void;
}) {
  return (
    <>
      <div role="radiogroup" aria-label="Texto" className="grid max-h-[22rem] gap-3 overflow-y-auto p-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {textos.map((t) => {
          const elegido = valor.textoId === t.id;
          return (
            <div
              key={t.id}
              className={cn(
                'relative flex rounded-2xl bg-card ring-1 ring-border transition-[box-shadow,background-color]',
                elegido ? 'bg-secondary ring-2 ring-pd-celeste' : 'hover:bg-muted',
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => onCambiar({ ...valor, textoId: t.id })}
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl p-4 pr-11 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-bold">{t.titulo}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{t.texto}</span>
                <span className="text-xs font-medium text-muted-foreground">Unas {palabras(t.texto)} palabras</span>
              </button>
              {onEditar && (
                <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label={`Editar "${t.titulo}"`} onClick={() => onEditar(t)}>
                  <Pencil />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Field orientation="horizontal" className="max-w-md">
          <Switch id="tipeo-facil" checked={valor.facil} onCheckedChange={(facil) => onCambiar({ ...valor, facil })} />
          <FieldContent>
            <FieldLabel htmlFor="tipeo-facil">Modo fácil</FieldLabel>
            <FieldDescription>Todo en minúsculas y sin tildes, para los que recién empiezan.</FieldDescription>
          </FieldContent>
        </Field>
        <Field className="w-fit">
          <FieldLabel id="tipeo-limite">Tiempo</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="tipeo-limite"
            value={String(valor.limiteSeg)}
            onValueChange={(v) => v && onCambiar({ ...valor, limiteSeg: v === 'null' ? null : Number(v) })}
          >
            {LIMITES_TIEMPO_TIPEO.map((s) => (
              <ToggleGroupItem key={String(s)} value={String(s)}>
                {NOMBRE_LIMITE(s)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            {valor.limiteSeg === null ? 'Termina cuando llegan todos (o cuando la cortes).' : 'Cuenta lo que llegó a tipear cada uno.'}
          </FieldDescription>
        </Field>
      </div>
    </>
  );
}

export function PrepararTipeo({ comisionId, nombreComision }: PropsPreparar) {
  const { pedir, controlarActividad } = useProfe();
  const { textos, cargar } = useTextosTipeo();
  const [opciones, setOpciones] = useState<OpcionesTipeo>({ textoId: 0, facil: false, limiteSeg: null });
  const [editando, setEditando] = useState<TextoTipeo | 'nuevo' | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si el elegido se borró (o todavía no hay ninguno), el primero.
  useEffect(() => {
    if (textos && textos.length > 0 && !textos.some((t) => t.id === opciones.textoId)) setOpciones((o) => ({ ...o, textoId: textos[0]!.id }));
  }, [textos, opciones.textoId]);

  const elegido = textos?.find((t) => t.id === opciones.textoId);

  const empezar = async () => {
    if (!elegido || !comisionId) return;
    setEnviando(true);
    const r = await controlarActividad({ tipo: 'iniciar', actividad: 'tipeo', comisionId: Number(comisionId), opciones });
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex items-center justify-between gap-3">
          <FieldLegend variant="label">Texto</FieldLegend>
          <Button variant="outline" size="sm" onClick={() => setEditando('nuevo')}>
            <Plus data-icon="inline-start" />
            Nuevo texto
          </Button>
        </div>
        {textos === null ? (
          <Spinner />
        ) : textos.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Keyboard />
              </EmptyMedia>
              <EmptyTitle>No hay textos</EmptyTitle>
              <EmptyDescription>Escribí uno: un párrafo corto sobre lo que estén viendo en clase.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <OpcionesCarrera valor={opciones} onCambiar={setOpciones} textos={textos} onEditar={setEditando} />
        )}
      </FieldSet>

      <BarraEmpezar
        resumen={!comisionId ? 'Elegí la comisión arriba' : !elegido ? 'Elegí un texto' : `Carrera con "${elegido.titulo}", comisión ${nombreComision ?? ''}`}
        falta={!elegido || !comisionId}
        texto="Abrir la sala de espera"
        enviando={enviando}
        onEmpezar={() => void empezar()}
      />

      <DialogoTextoTipeo
        texto={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={(t) => {
          void cargar();
          setOpciones((o) => ({ ...o, textoId: t.id }));
        }}
        onBorrado={() => void cargar()}
        pedir={pedir}
      />
    </div>
  );
}

function DialogoTextoTipeo({
  texto,
  onCerrar,
  onGuardado,
  onBorrado,
  pedir,
}: {
  texto: TextoTipeo | 'nuevo' | null;
  onCerrar: () => void;
  onGuardado: (t: TextoTipeo) => void;
  onBorrado: () => void;
  pedir: ReturnType<typeof useProfe>['pedir'];
}) {
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const existente = texto !== null && texto !== 'nuevo' ? texto : null;

  useEffect(() => {
    if (texto === null) return;
    setTitulo(existente?.titulo ?? '');
    setCuerpo(existente?.texto ?? '');
    setError(null);
  }, [texto, existente]);

  const largo = normalizarTexto(cuerpo).length;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const t = await pedir<TextoTipeo>(existente ? `/tipeo/textos/${existente.id}` : '/tipeo/textos', {
        method: existente ? 'PUT' : 'POST',
        body: { titulo, texto: cuerpo },
      });
      toast.success(existente ? 'Guardaste el texto' : 'Agregaste el texto');
      onGuardado(t);
      onCerrar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  const borrar = () =>
    existente &&
    setConfirmacion({
      titulo: `¿Borrar "${existente.titulo}"?`,
      descripcion: 'Las carreras que ya se hicieron con este texto quedan en Resultados.',
      accion: 'Borrar',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(`/tipeo/textos/${existente.id}`, { method: 'DELETE' });
          onBorrado();
          onCerrar();
        } catch (err) {
          toast.error(mensajeDe(err));
        }
      },
    });

  return (
    <>
      <Dialog open={texto !== null} onOpenChange={(o) => !o && onCerrar()}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{existente ? 'Editar texto' : 'Nuevo texto'}</DialogTitle>
              <DialogDescription>Un párrafo corto: entre 2 y 4 oraciones es lo justo para una carrera de un par de minutos.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tipeo-titulo">Título</FieldLabel>
                <Input id="tipeo-titulo" value={titulo} maxLength={LIMITES_TIPEO.titulo} onChange={(e) => setTitulo(e.target.value)} required />
              </Field>
              <Field data-invalid={largo > LIMITES_TIPEO.texto || undefined}>
                <FieldLabel htmlFor="tipeo-texto">Texto</FieldLabel>
                <Textarea
                  id="tipeo-texto"
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  className="min-h-40"
                  aria-invalid={largo > LIMITES_TIPEO.texto}
                  required
                />
                <FieldDescription>
                  {largo} de {LIMITES_TIPEO.texto} letras. Las comillas y guiones especiales se cambian por los del teclado.
                </FieldDescription>
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
            <DialogFooter className="sm:justify-between">
              {existente ? (
                <Button type="button" variant="ghost" className="text-destructive" onClick={borrar}>
                  <Trash2 data-icon="inline-start" />
                  Borrar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={enviando}>
                  {enviando && <Spinner data-icon="inline-start" />}
                  Guardar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </>
  );
}

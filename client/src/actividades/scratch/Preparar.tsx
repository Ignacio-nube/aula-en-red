import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, FileUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITES_SCRATCH, type ProyectoInicial } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { CLAVES, leer } from '@/lib/almacen';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BarraEmpezar } from '@/routes/profe/clase/BarraEmpezar';
import { useProfe } from '@/routes/profe/contexto';
import type { PropsPreparar } from '../tipos';

const MB = Math.round(LIMITES_SCRATCH.proyectoBytes / 1024 / 1024);

export function PrepararScratch({ comisionId, nombreComision }: PropsPreparar) {
  const { pedir, controlarActividad } = useProfe();
  const [iniciales, setIniciales] = useState<ProyectoInicial[] | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('Taller de Scratch');
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      setIniciales(await pedir<ProyectoInicial[]>('/scratch/iniciales'));
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  }, [pedir]);
  useEffect(() => void cargar(), [cargar]);

  const subir = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.sb3$/i.test(f.name)) return void toast.error('Tiene que ser un proyecto de Scratch (.sb3).');
    if (f.size > LIMITES_SCRATCH.proyectoBytes) return void toast.error(`Es demasiado pesado (máximo ${MB} MB).`);
    setSubiendo(true);
    try {
      const res = await fetch('/api/scratch/iniciales', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${leer(CLAVES.tokenProfe) ?? ''}`,
          'Content-Type': 'application/octet-stream',
          'X-Nombre': encodeURIComponent(f.name),
        },
        body: f,
      });
      const datos = (await res.json().catch(() => null)) as (ProyectoInicial[] & { error?: string }) | null;
      if (!res.ok || !datos) throw new Error(datos?.error ?? 'No se pudo subir. Probá de nuevo.');
      setIniciales(datos);
      // El recién subido es el más nuevo: queda elegido.
      setElegido(datos[0]?.id ?? null);
      setTitulo((t) => (t === 'Taller de Scratch' ? (datos[0]?.nombre ?? t).slice(0, LIMITES_SCRATCH.titulo) : t));
    } catch (e) {
      toast.error(mensajeDe(e));
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = '';
    }
  };

  const borrar = async (p: ProyectoInicial) => {
    try {
      setIniciales(await pedir<ProyectoInicial[]>(`/scratch/iniciales/${p.id}`, { method: 'DELETE' }));
      if (elegido === p.id) setElegido(null);
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  };

  const empezar = async () => {
    if (!comisionId) return;
    setEnviando(true);
    const r = await controlarActividad({
      tipo: 'iniciar',
      actividad: 'scratch',
      comisionId: Number(comisionId),
      opciones: { titulo, inicialId: elegido },
    });
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  const opcion = (id: number | null, nombre: string, detalle: string, extra?: ReactNode) => {
    const activo = elegido === id;
    return (
      <li key={id ?? 'vacio'} className="relative">
        <button
          type="button"
          role="radio"
          aria-checked={activo}
          onClick={() => setElegido(id)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl bg-card p-3 pr-12 text-left ring-1 ring-border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            activo && 'ring-2 ring-pd-celeste',
          )}
        >
          <span className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-2', activo ? 'bg-pd-celeste-oscuro text-white ring-pd-celeste-oscuro' : 'ring-border')}>
            {activo && <Check className="size-4" strokeWidth={3} />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{nombre}</span>
            <span className="text-sm text-muted-foreground">{detalle}</span>
          </span>
        </button>
        {extra}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLegend variant="label" className="mb-0">
            Proyecto para arrancar
          </FieldLegend>
          <input ref={archivo} type="file" accept=".sb3" className="hidden" onChange={(e) => void subir(e.target.files?.[0])} aria-label="Subir un proyecto .sb3" />
          <Button variant="outline" size="sm" disabled={subiendo} onClick={() => archivo.current?.click()}>
            {subiendo ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
            Subir un .sb3
          </Button>
        </div>
        <FieldDescription>
          Opcional. Hacé el proyecto en Scratch, guardalo con <em>Archivo → Guardar en tu computadora</em> y subilo acá. Todos arrancan con una copia.
        </FieldDescription>
        {iniciales === null ? (
          <Spinner />
        ) : (
          <ul role="radiogroup" aria-label="Proyecto para arrancar" className="grid gap-2 sm:grid-cols-2">
            {opcion(null, 'Proyecto vacío', 'El proyecto nuevo del editor, sin bloques')}
            {iniciales.map((p) =>
              opcion(
                p.id,
                p.nombre,
                `${new Date(p.subidoEn).toLocaleDateString('es-AR')} · ${Math.max(1, Math.round(p.bytes / 1024)).toLocaleString('es-AR')} KB`,
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label={`Borrar ${p.nombre} de la lista`}
                  onClick={() => void borrar(p)}
                >
                  <Trash2 />
                </Button>,
              ),
            )}
          </ul>
        )}
      </FieldSet>

      <Field className="w-full max-w-sm">
        <FieldLabel htmlFor="scratch-titulo">Título</FieldLabel>
        <Input id="scratch-titulo" value={titulo} maxLength={LIMITES_SCRATCH.titulo} onChange={(e) => setTitulo(e.target.value)} />
        <FieldDescription>Se ve arriba del editor y en la pantalla grande.</FieldDescription>
      </Field>

      <BarraEmpezar
        resumen={
          !comisionId
            ? 'Elegí la comisión arriba'
            : `${elegido === null ? 'Proyecto vacío' : (iniciales?.find((p) => p.id === elegido)?.nombre ?? '')}, comisión ${nombreComision ?? ''}`
        }
        falta={!comisionId}
        texto="Empezar el taller"
        enviando={enviando}
        onEmpezar={() => void empezar()}
      />
    </div>
  );
}

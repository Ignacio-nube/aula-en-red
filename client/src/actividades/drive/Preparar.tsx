import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITES_MISION, NOMBRE_TIPO_PASO, PLANTILLAS_MISIONES, textoPaso, type OpcionesMisiones, type PasoMision, type TipoPasoMision } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { BarraEmpezar } from '@/routes/profe/clase/BarraEmpezar';
import { useProfe } from '@/routes/profe/contexto';
import type { PropsPreparar } from '../tipos';

function pasoNuevo(tipo: TipoPasoMision): PasoMision {
  switch (tipo) {
    case 'carpeta':
      return { tipo, nombre: 'Arte' };
    case 'subir':
      return { tipo, carpeta: null, soloImagen: false };
    case 'renombrar':
      return { tipo, nombre: 'Mi archivo' };
    case 'mover':
      return { tipo, carpeta: 'Arte' };
    case 'compartir':
      return { tipo, carpeta: null };
    default:
      return { tipo } as PasoMision;
  }
}

/** A las misiones con nombre o carpeta obligatoria no les puede faltar. */
function completo(p: PasoMision): boolean {
  if (p.tipo === 'carpeta' || p.tipo === 'renombrar') return p.nombre.trim() !== '';
  if (p.tipo === 'mover') return p.carpeta.trim() !== '';
  return true;
}

export function PrepararMisiones({ comisionId, nombreComision }: PropsPreparar) {
  const { controlarActividad } = useProfe();
  const [opciones, setOpciones] = useState<OpcionesMisiones>(() => structuredClone(PLANTILLAS_MISIONES[0]!));
  const [enviando, setEnviando] = useState(false);

  const cambiarPaso = (i: number, p: PasoMision) => setOpciones((o) => ({ ...o, pasos: o.pasos.map((x, j) => (j === i ? p : x)) }));
  const listos = opciones.pasos.length > 0 && opciones.pasos.every(completo);

  const empezar = async () => {
    if (!comisionId || !listos) return;
    setEnviando(true);
    const r = await controlarActividad({ tipo: 'iniciar', actividad: 'drive', comisionId: Number(comisionId), opciones });
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">Empezá con una plantilla</FieldLegend>
        <div role="radiogroup" aria-label="Plantillas" className="grid gap-3 sm:grid-cols-3">
          {PLANTILLAS_MISIONES.map((p) => {
            const elegida = opciones.titulo === p.titulo;
            return (
              <button
                key={p.titulo}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => setOpciones(structuredClone({ titulo: p.titulo, pasos: p.pasos }))}
                className={cn(
                  'flex flex-col gap-1 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-[box-shadow,background-color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  elegida ? 'bg-secondary ring-2 ring-pd-celeste' : 'hover:bg-muted',
                )}
              >
                <span className="font-bold">{p.titulo}</span>
                <span className="text-sm text-muted-foreground">{p.descripcion}</span>
                <span className="text-xs font-medium text-muted-foreground">{p.pasos.length} misiones</span>
              </button>
            );
          })}
        </div>
      </FieldSet>

      <Field className="max-w-md">
        <FieldLabel htmlFor="misiones-titulo">Título</FieldLabel>
        <Input
          id="misiones-titulo"
          value={opciones.titulo}
          maxLength={LIMITES_MISION.titulo}
          onChange={(e) => setOpciones((o) => ({ ...o, titulo: e.target.value }))}
        />
      </Field>

      <FieldSet>
        <FieldLegend variant="label">Misiones</FieldLegend>
        <FieldDescription>Se tildan solas cuando el alumno lo hace en su Drive. Los nombres no distinguen mayúsculas ni tildes.</FieldDescription>
        <ol className="flex flex-col gap-2">
          {opciones.pasos.map((p, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3 sm:flex-row sm:items-center">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-sm font-bold">{i + 1}</span>
              <Select value={p.tipo} onValueChange={(t) => cambiarPaso(i, pasoNuevo(t as TipoPasoMision))}>
                <SelectTrigger aria-label={`Tipo de la misión ${i + 1}`} className="w-full bg-card sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(NOMBRE_TIPO_PASO) as TipoPasoMision[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {NOMBRE_TIPO_PASO[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <ParametrosPaso paso={p} onCambiar={(n) => cambiarPaso(i, n)} indice={i} />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="self-end sm:self-auto"
                aria-label={`Quitar la misión ${i + 1}`}
                onClick={() => setOpciones((o) => ({ ...o, pasos: o.pasos.filter((_, j) => j !== i) }))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        {opciones.pasos.length < LIMITES_MISION.pasos && (
          <Button variant="outline" className="self-start" onClick={() => setOpciones((o) => ({ ...o, pasos: [...o.pasos, pasoNuevo('subir')] }))}>
            <Plus data-icon="inline-start" />
            Agregar una misión
          </Button>
        )}
      </FieldSet>

      {opciones.pasos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-pd-celeste-claro/60 p-4">
          <p className="text-sm font-semibold">Así lo ven los alumnos:</p>
          <ol className="list-inside list-decimal text-sm">
            {opciones.pasos.map((p, i) => (
              <li key={i}>{textoPaso(p)}</li>
            ))}
          </ol>
        </div>
      )}

      <BarraEmpezar
        resumen={
          !comisionId
            ? 'Elegí la comisión arriba'
            : !listos
              ? 'Completá las misiones'
              : `"${opciones.titulo || 'Misiones en Drive'}", ${opciones.pasos.length} misiones, comisión ${nombreComision ?? ''}`
        }
        falta={!comisionId || !listos}
        texto="Empezar las misiones"
        enviando={enviando}
        onEmpezar={() => void empezar()}
      />
    </div>
  );
}

function ParametrosPaso({ paso, onCambiar, indice }: { paso: PasoMision; onCambiar: (p: PasoMision) => void; indice: number }) {
  const id = `mision-${indice}`;
  const campoCarpeta = (valor: string | null, opcional: boolean, cambiar: (v: string | null) => void) => (
    <Input
      aria-label={`Carpeta de la misión ${indice + 1}`}
      placeholder={opcional ? 'Carpeta (opcional)' : 'Carpeta'}
      value={valor ?? ''}
      maxLength={LIMITES_MISION.nombre}
      onChange={(e) => cambiar(opcional && e.target.value === '' ? null : e.target.value)}
      className="w-full bg-card sm:w-48"
    />
  );
  switch (paso.tipo) {
    case 'carpeta':
    case 'renombrar':
      return (
        <Input
          aria-label={`Nombre de la misión ${indice + 1}`}
          placeholder="Nombre"
          value={paso.nombre}
          maxLength={LIMITES_MISION.nombre}
          onChange={(e) => onCambiar({ ...paso, nombre: e.target.value })}
          className="w-full bg-card sm:w-56"
        />
      );
    case 'subir':
      return (
        <>
          {campoCarpeta(paso.carpeta, true, (carpeta) => onCambiar({ ...paso, carpeta }))}
          <label htmlFor={`${id}-imagen`} className="flex items-center gap-2 text-sm font-medium">
            <Switch id={`${id}-imagen`} checked={paso.soloImagen} onCheckedChange={(soloImagen) => onCambiar({ ...paso, soloImagen })} />
            Que sea una imagen
          </label>
        </>
      );
    case 'mover':
      return campoCarpeta(paso.carpeta, false, (carpeta) => onCambiar({ ...paso, carpeta: carpeta ?? '' }));
    case 'compartir':
      return campoCarpeta(paso.carpeta, true, (carpeta) => onCambiar({ ...paso, carpeta }));
    default:
      return <span className="text-sm text-muted-foreground">{textoPaso(paso)}</span>;
  }
}

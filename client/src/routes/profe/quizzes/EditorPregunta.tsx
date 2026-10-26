import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Check, CircleAlert, Copy, EllipsisVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { LETRAS, LIMITES, maxOpciones, NOMBRE_MULTIPLICADOR, NOMBRE_TIPO, TIEMPOS_SEG, TIPOS_PREGUNTA, type Multiplicador, type TipoPregunta } from '@aula/shared';
import { estiloRespuesta, FormaRespuesta } from '@/components/pd/Respuesta';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { mensajeDe } from '@/lib/api';
import { prepararImagen } from '@/lib/imagen';
import { urlImagen } from '@/lib/juego';
import { cn } from '@/lib/utils';
import { useProfe } from '../contexto';
import { cambiarTipo, nuevaClave, problemas, type PreguntaBorrador } from './borrador';

interface Props {
  pregunta: PreguntaBorrador;
  numero: number;
  puedeBorrar: boolean;
  onCambiar: (p: PreguntaBorrador) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
}

export function EditorPregunta({ pregunta: p, numero, puedeBorrar, onCambiar, onDuplicar, onBorrar }: Props) {
  const { pedir } = useProfe();
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const faltan = problemas(p);

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const blob = await prepararImagen(archivo);
      const { archivo: nombre } = await pedir<{ archivo: string }>('/imagenes', { method: 'POST', body: blob });
      onCambiar({ ...p, imagen: nombre });
    } catch (e) {
      toast.error(mensajeDe(e));
    } finally {
      setSubiendo(false);
    }
  };

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void subir(e.dataTransfer.files[0]);
  };

  // Pegar una captura con Ctrl+V en cualquier parte de la pregunta.
  const alPegar = (e: ClipboardEvent) => {
    const archivo = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (archivo) {
      e.preventDefault();
      void subir(archivo);
    }
  };

  const cambiarOpcion = (i: number, cambios: Partial<{ texto: string; esCorrecta: boolean }>) =>
    onCambiar({ ...p, opciones: p.opciones.map((o, j) => (j === i ? { ...o, ...cambios } : o)) });

  // Opción múltiple y V/F: marcar una desmarca las demás. Varias correctas: cada una se prende y apaga.
  const marcarCorrecta = (i: number) =>
    onCambiar({
      ...p,
      opciones: p.opciones.map((o, j) => (p.tipo === 'varias' ? (j === i ? { ...o, esCorrecta: !o.esCorrecta } : o) : { ...o, esCorrecta: j === i })),
    });

  const moverPaso = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= p.opciones.length) return;
    const opciones = [...p.opciones];
    [opciones[i], opciones[j]] = [opciones[j]!, opciones[i]!];
    onCambiar({ ...p, opciones });
  };

  const agregarOpcion = () =>
    onCambiar({ ...p, opciones: [...p.opciones, { clave: nuevaClave(), texto: '', esCorrecta: p.tipo === 'ordenar' }] });
  const minimo = p.tipo === 'ordenar' ? LIMITES.minPasos : LIMITES.minOpciones;

  return (
    <Card onPaste={alPegar}>
      <CardHeader>
        <CardTitle className="text-xl">Pregunta {numero}</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Más opciones de la pregunta">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onDuplicar}>
                  <Copy />
                  Duplicar pregunta
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" disabled={!puedeBorrar} onSelect={onBorrar}>
                  <Trash2 />
                  Borrar pregunta
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="flex flex-wrap items-end gap-4">
            <Field className="w-52">
              <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
              <Select value={p.tipo} onValueChange={(v) => onCambiar(cambiarTipo(p, v as TipoPregunta))}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIPOS_PREGUNTA.map((t) => (
                      <SelectItem key={t} value={t}>
                        {NOMBRE_TIPO[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-36">
              <FieldLabel htmlFor="tiempo">Tiempo</FieldLabel>
              <Select value={String(p.tiempoSeg)} onValueChange={(v) => onCambiar({ ...p, tiempoSeg: Number(v) })}>
                <SelectTrigger id="tiempo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIEMPOS_SEG.map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {t < 60 ? `${t} segundos` : t === 60 ? '1 minuto' : `${t / 60} minutos`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-40">
              <FieldLabel htmlFor="puntos">Puntos</FieldLabel>
              <Select value={String(p.multiplicador)} onValueChange={(v) => onCambiar({ ...p, multiplicador: Number(v) as Multiplicador })}>
                <SelectTrigger id="puntos" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {([1, 2, 0] as const).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {NOMBRE_MULTIPLICADOR[m]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="texto-pregunta">Pregunta</FieldLabel>
            <Textarea
              id="texto-pregunta"
              autoFocus={!p.texto}
              value={p.texto}
              maxLength={LIMITES.pregunta}
              placeholder="Por ejemplo: ¿Cuál de estos es un navegador web?"
              onChange={(e) => onCambiar({ ...p, texto: e.target.value })}
              className="min-h-20 text-lg font-semibold md:text-lg"
            />
            <span className="self-end text-xs text-muted-foreground tabular-nums">
              {p.texto.length}/{LIMITES.pregunta}
            </span>
          </Field>

          {/* Imagen opcional: botón, arrastrar y soltar, o pegar con Ctrl+V */}
          <Field>
            <FieldLabel>Imagen (opcional)</FieldLabel>
            {p.imagen ? (
              <div className="flex items-center gap-4">
                <img src={urlImagen(p.imagen)} alt="" className="h-28 max-w-56 rounded-2xl object-cover shadow-[var(--pd-sombra-tarjeta)]" />
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => archivoRef.current?.click()} disabled={subiendo}>
                    {subiendo ? <Spinner data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
                    Cambiar imagen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onCambiar({ ...p, imagen: null })}>
                    <X data-icon="inline-start" />
                    Quitar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => archivoRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={alSoltar}
                disabled={subiendo}
                className={cn(
                  'flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input px-4 py-5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-pd-celeste hover:bg-pd-celeste-claro/50 focus-visible:ring-3 focus-visible:ring-ring/50',
                  arrastrando && 'border-pd-celeste bg-pd-celeste-claro',
                )}
              >
                {subiendo ? <Spinner /> : <ImagePlus className="size-5" />}
                {subiendo ? 'Subiendo…' : 'Elegí una imagen, arrastrala acá o pegala con Ctrl+V'}
              </button>
            )}
            <input
              ref={archivoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                void subir(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </Field>

          <FieldSet>
            <FieldLegend variant="label">
              {p.tipo === 'vf'
                ? 'Tocá la respuesta correcta'
                : p.tipo === 'varias'
                  ? 'Opciones (marcá todas las correctas)'
                  : p.tipo === 'ordenar'
                    ? 'Pasos, en el orden correcto (los alumnos los ven mezclados)'
                    : 'Opciones (marcá la correcta)'}
            </FieldLegend>
            {p.tipo === 'ordenar' ? (
              <ol className="flex flex-col gap-2">
                {p.opciones.map((o, i) => (
                  <li key={o.clave} className="flex items-center gap-2 rounded-2xl bg-muted/60 p-1.5 pl-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-sm font-bold text-white tabular-nums">
                      {i + 1}
                    </span>
                    <Input
                      aria-label={`Paso ${i + 1}`}
                      placeholder={`Paso ${i + 1}`}
                      value={o.texto}
                      maxLength={LIMITES.opcion}
                      onChange={(ev) => cambiarOpcion(i, { texto: ev.target.value })}
                      className="h-10 flex-1 border-transparent bg-card"
                    />
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Subir el paso ${i + 1}`} disabled={i === 0} onClick={() => moverPaso(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Bajar el paso ${i + 1}`}
                      disabled={i === p.opciones.length - 1}
                      onClick={() => moverPaso(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {p.opciones.length > minimo && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Quitar el paso ${i + 1}`}
                        onClick={() => onCambiar({ ...p, opciones: p.opciones.filter((_, j) => j !== i) })}
                      >
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
                {p.opciones.length < maxOpciones('ordenar') && (
                  <Button variant="outline" className="rounded-2xl border-dashed" onClick={agregarOpcion}>
                    <Plus data-icon="inline-start" />
                    Agregar paso
                  </Button>
                )}
              </ol>
            ) : p.tipo === 'vf' ? (
              <div role="radiogroup" aria-label="Respuesta correcta" className="grid grid-cols-2 gap-3">
                {p.opciones.map((o, i) => {
                  const e = estiloRespuesta('vf', i);
                  return (
                    <button
                      key={o.clave}
                      type="button"
                      role="radio"
                      aria-checked={o.esCorrecta}
                      onClick={() => marcarCorrecta(i)}
                      className={cn(
                        'flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-lg font-bold transition-[opacity,transform] outline-none focus-visible:ring-4 focus-visible:ring-pd-celeste/50 active:scale-[0.98]',
                        !o.esCorrecta && 'opacity-40 hover:opacity-70',
                      )}
                      style={{ backgroundColor: e.fondo, color: e.texto }}
                    >
                      <FormaRespuesta forma={e.forma} color={e.texto} className="size-6" />
                      {o.texto}
                      {o.esCorrecta && <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-sm">Correcta</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {p.opciones.map((o, i) => {
                  const e = estiloRespuesta('multiple', i);
                  return (
                    <div
                      key={o.clave}
                      className={cn('flex items-center gap-2 rounded-2xl p-1.5 pl-3 ring-2 transition-colors', o.esCorrecta ? 'ring-nivel-fuerte' : 'ring-transparent')}
                      style={{ backgroundColor: `color-mix(in oklch, ${e.fondo} 14%, var(--card))` }}
                    >
                      <FormaRespuesta forma={e.forma} color={e.fondo} className="size-6 shrink-0" />
                      <Input
                        aria-label={`Opción ${LETRAS[i]}`}
                        placeholder={`Opción ${LETRAS[i]}${i >= 2 ? ' (opcional)' : ''}`}
                        value={o.texto}
                        maxLength={LIMITES.opcion}
                        onChange={(ev) => cambiarOpcion(i, { texto: ev.target.value })}
                        className="h-10 flex-1 border-transparent"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={o.esCorrecta ? 'default' : 'outline'}
                        aria-label={o.esCorrecta ? `La opción ${LETRAS[i]} es correcta` : `Marcar la opción ${LETRAS[i]} como correcta`}
                        aria-pressed={o.esCorrecta}
                        onClick={() => marcarCorrecta(i)}
                        className={cn(o.esCorrecta && 'bg-nivel-fuerte hover:bg-nivel-fuerte/90')}
                      >
                        <Check />
                      </Button>
                      {p.opciones.length > minimo && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Quitar la opción ${LETRAS[i]}`}
                          onClick={() => onCambiar({ ...p, opciones: p.opciones.filter((_, j) => j !== i) })}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {p.opciones.length < maxOpciones(p.tipo) && (
                  <Button variant="outline" className="h-auto min-h-13 rounded-2xl border-dashed" onClick={agregarOpcion}>
                    Agregar opción
                  </Button>
                )}
              </div>
            )}
          </FieldSet>

          {faltan.length > 0 && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Para poder jugarla falta:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {faltan.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

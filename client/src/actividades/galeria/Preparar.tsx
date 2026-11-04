import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ImageOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITES_GALERIA, type ImagenDisponible, type MostrarAutor } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CLAVES, leer } from '@/lib/almacen';
import { mensajeDe } from '@/lib/api';
import { urlArchivo } from '@/lib/drive';
import { cn } from '@/lib/utils';
import { BarraEmpezar } from '@/routes/profe/clase/BarraEmpezar';
import { useProfe } from '@/routes/profe/contexto';
import type { PropsPreparar } from '../tipos';

const TODAS = '__todas__';
const SUELTAS = '__sueltas__';

const AUTOR: { valor: MostrarAutor; nombre: string; descripcion: string }[] = [
  { valor: 'final', nombre: 'En el podio', descripcion: 'Mientras votan no se sabe de quién es cada dibujo; en el podio, sí.' },
  { valor: 'revelar', nombre: 'Al mostrar los votos', descripcion: 'Se ve de quién es cada dibujo cuando mostrás cómo lo votaron.' },
  { valor: 'nunca', nombre: 'Nunca', descripcion: 'Todo anónimo, también en el podio. Vos sí lo ves en tu compu.' },
];

export function PrepararGaleria({ comisionId, nombreComision }: PropsPreparar) {
  const { pedir, controlarActividad, socket } = useProfe();
  const token = leer(CLAVES.tokenProfe) ?? '';
  const [imagenes, setImagenes] = useState<ImagenDisponible[] | null>(null);
  const [carpeta, setCarpeta] = useState(TODAS);
  const [soloCompartidas, setSoloCompartidas] = useState(false);
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [titulo, setTitulo] = useState('Votación de dibujos');
  const [mostrarAutor, setMostrarAutor] = useState<MostrarAutor>('final');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    if (!comisionId) return setImagenes([]);
    try {
      const lista = await pedir<ImagenDisponible[]>(`/profe/drive/imagenes?comision=${comisionId}`);
      setImagenes(lista);
      // Arranca con la carpeta que más se repite (por ejemplo, "Arte") y solo lo compartido, si hay.
      const cuenta = new Map<string, number>();
      for (const i of lista) if (i.carpeta) cuenta.set(i.carpeta.toLowerCase(), (cuenta.get(i.carpeta.toLowerCase()) ?? 0) + 1);
      const masUsada = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      setCarpeta((c) => (c !== TODAS ? c : (masUsada ?? TODAS)));
      setSoloCompartidas(lista.some((i) => i.compartido));
    } catch (e) {
      toast.error(mensajeDe(e));
    }
  }, [pedir, comisionId]);

  useEffect(() => void cargar(), [cargar]);

  // Si alguien sube o comparte un dibujo mientras el profe prepara, aparece solo.
  useEffect(() => {
    if (!socket) return;
    const alCambio = () => void cargar();
    socket.on('drive:cambio', alCambio);
    return () => {
      socket.off('drive:cambio', alCambio);
    };
  }, [socket, cargar]);

  const carpetas = useMemo(() => {
    const nombres = new Map<string, string>();
    for (const i of imagenes ?? []) if (i.carpeta && !nombres.has(i.carpeta.toLowerCase())) nombres.set(i.carpeta.toLowerCase(), i.carpeta);
    return [...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [imagenes]);

  const filtradas = (imagenes ?? []).filter(
    (i) => (!soloCompartidas || i.compartido) && (carpeta === TODAS || (carpeta === SUELTAS ? i.carpeta === null : i.carpeta?.toLowerCase() === carpeta)),
  );
  const elegidas = filtradas.filter((i) => !excluidas.has(i.itemId));
  const demasiadas = elegidas.length > LIMITES_GALERIA.imagenes;

  const alternar = (id: number) =>
    setExcluidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const empezar = async () => {
    if (!comisionId || elegidas.length === 0 || demasiadas) return;
    setEnviando(true);
    const r = await controlarActividad({
      tipo: 'iniciar',
      actividad: 'galeria',
      comisionId: Number(comisionId),
      opciones: { titulo, itemIds: elegidas.map((i) => i.itemId), mostrarAutor },
    });
    setEnviando(false);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="galeria-carpeta">Carpeta</FieldLabel>
            <Select value={carpeta} onValueChange={setCarpeta}>
              <SelectTrigger id="galeria-carpeta" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={TODAS}>Todas las imágenes</SelectItem>
                  {carpetas.map(([clave, nombre]) => (
                    <SelectItem key={clave} value={clave}>
                      {nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value={SUELTAS}>Sueltas en Mi unidad</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal" className="w-fit">
            <Switch id="galeria-compartidas" checked={soloCompartidas} onCheckedChange={setSoloCompartidas} />
            <FieldContent>
              <FieldLabel htmlFor="galeria-compartidas">Solo las que me compartieron</FieldLabel>
            </FieldContent>
          </Field>
          <Button variant="ghost" size="sm" onClick={() => void cargar()}>
            <RefreshCw data-icon="inline-start" />
            Actualizar
          </Button>
        </div>

        {imagenes === null ? (
          <Spinner />
        ) : filtradas.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>{imagenes.length === 0 ? 'Todavía no hay imágenes' : 'No hay imágenes con ese filtro'}</EmptyTitle>
              <EmptyDescription>
                {imagenes.length === 0
                  ? 'Los dibujos salen de los Drives de los alumnos. Probá antes con las misiones "Entregar un dibujo".'
                  : 'Cambiá la carpeta o mostrá también las que no te compartieron.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLegend variant="label" className="mb-0">
                {elegidas.length} de {filtradas.length} elegidas
              </FieldLegend>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setExcluidas(new Set())}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setExcluidas(new Set(filtradas.map((i) => i.itemId)))}>
                  Ninguna
                </Button>
              </div>
            </div>
            <ul className="grid max-h-[28rem] grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 overflow-y-auto p-0.5">
              {filtradas.map((i) => {
                const elegida = !excluidas.has(i.itemId);
                return (
                  <li key={i.itemId}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={elegida}
                      aria-label={`${i.nombre}, de ${i.alumnoNombre}`}
                      onClick={() => alternar(i.itemId)}
                      className={cn(
                        'relative flex w-full flex-col overflow-hidden rounded-2xl bg-card text-left ring-1 ring-border transition-[box-shadow,opacity] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        elegida ? 'ring-2 ring-pd-celeste' : 'opacity-50',
                      )}
                    >
                      <img src={urlArchivo(i.itemId, token)} alt="" loading="lazy" className="aspect-square w-full bg-muted object-cover" />
                      <span
                        className={cn(
                          'absolute top-2 right-2 grid size-6 place-items-center rounded-full ring-2 ring-white',
                          elegida ? 'bg-pd-celeste-oscuro text-white' : 'bg-black/30 text-transparent',
                        )}
                      >
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                      <span className="flex items-center gap-2 p-2">
                        <PinAvatar avatar={i.alumnoAvatar} tamano={22} />
                        <span className="min-w-0 truncate text-xs font-semibold">{i.alumnoNombre}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {demasiadas && <p className="text-sm text-destructive">Pueden ser hasta {LIMITES_GALERIA.imagenes} dibujos. Destildá algunos.</p>}
          </>
        )}
      </FieldSet>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Field className="w-full max-w-sm">
          <FieldLabel htmlFor="galeria-titulo">Título</FieldLabel>
          <Input id="galeria-titulo" value={titulo} maxLength={LIMITES_GALERIA.titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
        <Field className="w-fit">
          <FieldLabel id="galeria-autor">¿Cuándo se ve de quién es cada dibujo?</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="galeria-autor"
            value={mostrarAutor}
            onValueChange={(v) => v && setMostrarAutor(v as MostrarAutor)}
            className="flex-wrap"
          >
            {AUTOR.map((a) => (
              <ToggleGroupItem key={a.valor} value={a.valor}>
                {a.nombre}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{AUTOR.find((a) => a.valor === mostrarAutor)?.descripcion}</FieldDescription>
        </Field>
      </div>

      <BarraEmpezar
        resumen={
          !comisionId
            ? 'Elegí la comisión arriba'
            : elegidas.length === 0
              ? 'Elegí al menos un dibujo'
              : `${elegidas.length} ${elegidas.length === 1 ? 'dibujo' : 'dibujos'} para votar, comisión ${nombreComision ?? ''}`
        }
        falta={!comisionId || elegidas.length === 0 || demasiadas}
        texto="Empezar la votación"
        enviando={enviando}
        onEmpezar={() => void empezar()}
      />
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ArrowLeft, ChevronRight, Download, Folder, Lock, UserPlus, X } from 'lucide-react';
import { esImagen, LIMITES_DRIVE, MIMES_VISTA_PREVIA, type ItemDrive } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { iconoDe, ordenar, rutaHasta, urlArchivo } from '@/lib/drive';
import { cn } from '@/lib/utils';

/** Nueva carpeta o cambiar nombre: un campo y Aceptar, como en el real. */
export function DialogoNombre({
  abierto,
  titulo,
  inicial,
  boton,
  onCerrar,
  onAceptar,
}: {
  abierto: boolean;
  titulo: string;
  inicial: string;
  boton: string;
  onCerrar: () => void;
  onAceptar: (nombre: string) => Promise<boolean>;
}) {
  const [nombre, setNombre] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre(inicial);
    // Como en el Drive: queda seleccionado el nombre sin la extensión, listo para escribir encima.
    const id = setTimeout(() => {
      const fin = inicial.lastIndexOf('.') > 0 ? inicial.lastIndexOf('.') : inicial.length;
      campo.current?.focus();
      campo.current?.setSelectionRange(0, fin);
    }, 30);
    return () => clearTimeout(id);
  }, [abierto, inicial]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    const ok = await onAceptar(nombre.trim());
    setEnviando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription className="sr-only">Escribí el nombre.</DialogDescription>
          </DialogHeader>
          <Input ref={campo} aria-label="Nombre" value={nombre} maxLength={LIMITES_DRIVE.nombre} onChange={(e) => setNombre(e.target.value)} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!nombre.trim() || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              {boton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compartir: se agrega al profe escribiendo o tocando la sugerencia y después "Enviar", como en el real.
 * Si ya está compartido, se ve quién tiene acceso y se le puede quitar.
 */
export function DialogoCompartir({
  item,
  alumno,
  onCerrar,
  onCompartir,
}: {
  item: ItemDrive | null;
  alumno: { nombre: string; avatar: string };
  onCerrar: () => void;
  onCompartir: (compartido: boolean) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState('');
  const [agregado, setAgregado] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    setTexto('');
    setAgregado(false);
  }, [item?.id]);

  // Como en el real: la sugerencia aparece al escribir (o al tocar el campo vacío).
  const q = texto.trim().toLowerCase();
  const coincide = q === '' ? enfocado : 'profe'.startsWith(q) || q.includes('prof');
  const sugerir = coincide && !agregado && !item?.compartido;
  // Si escribió "profe" (o casi) pero no tocó la sugerencia, igual se entiende que quiere compartir con el profe.
  const escribioProfe = q.length >= 3 && ('profe'.startsWith(q) || q.includes('prof'));
  const listoParaEnviar = !item?.compartido && (agregado || escribioProfe);
  const cambiar = async (compartido: boolean) => {
    setEnviando(true);
    const ok = await onCompartir(compartido);
    setEnviando(false);
    if (ok && compartido) onCerrar();
  };

  return (
    <Dialog open={item !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">Compartir "{item?.nombre}"</DialogTitle>
          <DialogDescription className="sr-only">Elegí con quién compartir este archivo.</DialogDescription>
        </DialogHeader>

        {!item?.compartido && (
          <div className="relative">
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ring-input focus-within:ring-2 focus-within:ring-ring">
              {agregado && (
                <span className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-sm font-medium">
                  Profe
                  <button type="button" aria-label="Quitar a Profe" className="rounded-full p-0.5 hover:bg-foreground/10" onClick={() => setAgregado(false)}>
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              <input
                aria-label="Agregar personas"
                placeholder={agregado ? '' : 'Agregar personas'}
                className="min-w-24 flex-1 bg-transparent px-1 py-1 text-base outline-none"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onFocus={() => setEnfocado(true)}
                onBlur={() => setTimeout(() => setEnfocado(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sugerir) {
                    e.preventDefault();
                    setAgregado(true);
                    setTexto('');
                  }
                }}
              />
            </div>
            {sugerir && (
              <button
                type="button"
                className="absolute inset-x-0 top-full z-10 mt-1 flex items-center gap-3 rounded-xl bg-popover p-3 text-left shadow-md ring-1 ring-foreground/10 hover:bg-accent"
                onClick={() => {
                  setAgregado(true);
                  setTexto('');
                }}
              >
                <span className="grid size-9 place-items-center rounded-full bg-pd-celeste-oscuro text-sm font-bold text-white">P</span>
                <span className="flex flex-col">
                  <span className="font-semibold">Profe</span>
                  <span className="text-sm text-muted-foreground">El profe de la clase</span>
                </span>
              </button>
            )}
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Personas con acceso</h3>
          <ul className="flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <PinAvatar avatar={alumno.avatar} tamano={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{alumno.nombre} (vos)</span>
              </span>
              <span className="text-sm text-muted-foreground">Propietario</span>
            </li>
            {item?.compartido && (
              <li className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-pd-celeste-oscuro text-sm font-bold text-white">P</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">Profe</span>
                  <span className="text-sm text-muted-foreground">El profe de la clase</span>
                </span>
                <Button variant="ghost" size="sm" disabled={enviando} onClick={() => void cambiar(false)}>
                  Quitar acceso
                </Button>
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Acceso general</h3>
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-muted">
              <Lock className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">Restringido</span>
              <span className="text-sm text-muted-foreground">Solo las personas con acceso pueden abrirlo.</span>
            </span>
          </div>
        </section>

        <DialogFooter>
          {!listoParaEnviar ? (
            <DialogClose asChild>
              <Button>Listo</Button>
            </DialogClose>
          ) : (
            <Button disabled={enviando} onClick={() => void cambiar(true)}>
              {enviando ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
              Enviar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mover: se navega por las carpetas y se elige el destino. */
export function DialogoMover({
  item,
  items,
  onCerrar,
  onMover,
}: {
  item: ItemDrive | null;
  items: ItemDrive[];
  onCerrar: () => void;
  onMover: (destino: number | null) => Promise<boolean>;
}) {
  const [aca, setAca] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (item) setAca(item.padreId);
  }, [item]);

  // No se puede mover una carpeta adentro de sí misma ni de las suyas.
  const prohibidas = new Set<number>();
  if (item?.tipo === 'carpeta') {
    prohibidas.add(item.id);
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const i of items) {
        if (i.padreId !== null && prohibidas.has(i.padreId) && !prohibidas.has(i.id)) {
          prohibidas.add(i.id);
          cambio = true;
        }
      }
    }
  }
  const carpetas = ordenar(items.filter((i) => i.tipo === 'carpeta' && !i.enPapelera && i.padreId === aca && !prohibidas.has(i.id)));
  const ruta = rutaHasta(items, aca);
  const nombreAca = ruta.at(-1)?.nombre ?? 'Mi unidad';

  const mover = async () => {
    setEnviando(true);
    const ok = await onMover(aca);
    setEnviando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={item !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">Mover "{item?.nombre}"</DialogTitle>
          <DialogDescription>
            Ubicación actual: <span className="font-semibold text-foreground">{rutaHasta(items, item?.padreId ?? null).at(-1)?.nombre ?? 'Mi unidad'}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-64 flex-col overflow-hidden rounded-2xl ring-1 ring-border">
          <div className="flex items-center gap-1 border-b bg-muted/50 px-2 py-1.5">
            {aca !== null && (
              <Button variant="ghost" size="icon-sm" aria-label="Subir un nivel" onClick={() => setAca(ruta.at(-2)?.id ?? null)}>
                <ArrowLeft />
              </Button>
            )}
            <span className="truncate px-1 font-semibold">{nombreAca}</span>
          </div>
          <ul className="flex max-h-72 flex-col overflow-y-auto p-1">
            {carpetas.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No hay carpetas acá.</li>}
            {carpetas.map((c) => (
              <li key={c.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-accent" onClick={() => setAca(c.id)}>
                  <Folder className="size-5 shrink-0 fill-current text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button disabled={enviando || aca === item?.padreId} onClick={() => void mover()}>
            {enviando && <Spinner data-icon="inline-start" />}
            Mover acá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Vista previa a pantalla completa (fondo oscuro, barra arriba con el nombre y Descargar).
 * Es un Dialog de Radix para poder abrirse también desde adentro de otro diálogo (el del profe).
 */
export function VistaPrevia({ item, token, onCerrar }: { item: ItemDrive | null; token: string; onCerrar: () => void }) {
  const { icono: Icono, color } = item ? iconoDe(item) : { icono: Folder, color: '' };
  const mostrable = item?.mime != null && (MIMES_VISTA_PREVIA as readonly string[]).includes(item.mime);
  return (
    <DialogPrimitive.Root open={item !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white outline-none" aria-describedby={undefined}>
          {item && (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" aria-label="Cerrar">
                    <ArrowLeft />
                  </Button>
                </DialogPrimitive.Close>
                <Icono className={cn('size-5 shrink-0', color)} />
                <DialogPrimitive.Title className="min-w-0 flex-1 truncate font-medium">{item.nombre}</DialogPrimitive.Title>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" aria-label="Descargar" asChild>
                  <a href={urlArchivo(item.id, token, true)} download={item.nombre}>
                    <Download />
                  </a>
                </Button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
                {esImagen(item.mime) ? (
                  <img src={urlArchivo(item.id, token)} alt={item.nombre} className="max-h-full max-w-full rounded-md object-contain shadow-2xl" />
                ) : mostrable ? (
                  <iframe src={urlArchivo(item.id, token)} title={item.nombre} className="size-full max-w-4xl rounded-md bg-white" />
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-2xl bg-neutral-800 p-8 text-center">
                    <Icono className={cn('size-14', color)} />
                    <p className="text-lg">No hay vista previa disponible</p>
                    <Button asChild>
                      <a href={urlArchivo(item.id, token, true)} download={item.nombre}>
                        <Download data-icon="inline-start" />
                        Descargar
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

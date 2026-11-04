import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ContextMenu as MenuContextual } from 'radix-ui';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CloudUpload,
  Download,
  Eye,
  FolderInput,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  StarOff,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatoTamano, type CambioDrive, type ItemDrive, type MiDrive } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api, mensajeDe } from '@/lib/api';
import { fechaCorta, iconoDe, ordenar, rutaHasta, urlArchivo } from '@/lib/drive';
import { cn } from '@/lib/utils';
import { Confirmar, type PedidoConfirmacion } from '@/routes/profe/Confirmar';
import { DialogoCompartir, DialogoMover, DialogoNombre, VistaPrevia } from './Dialogos';
import { PanelSubidas, useSubidas } from './Subidas';

type Seccion = 'unidad' | 'recientes' | 'destacados' | 'papelera';
type Vista = 'cuadricula' | 'lista';

const SECCIONES: { valor: Seccion; nombre: string; icono: LucideIcon }[] = [
  { valor: 'unidad', nombre: 'Mi unidad', icono: HardDrive },
  { valor: 'recientes', nombre: 'Recientes', icono: Clock },
  { valor: 'destacados', nombre: 'Destacados', icono: Star },
  { valor: 'papelera', nombre: 'Papelera', icono: Trash2 },
];

const TIPO_ARRASTRE = 'application/x-aula-drive';
const CLAVE_VISTA = 'aula:drive-vista';

/** Mismo estilo que los items de DropdownMenu, para el menú del clic derecho. */
const CLASE_ITEM_MENU =
  "relative flex cursor-default items-center gap-2 rounded-xl px-2.5 py-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

interface OpcionMenu {
  clave: string;
  texto: string;
  icono: LucideIcon;
  accion: () => void;
  destructiva?: boolean;
  /** Va después de una línea. */
  separada?: boolean;
}

interface Props {
  drive: MiDrive | null;
  setDrive: (d: MiDrive) => void;
  /** Para pedir a la API y para ver los archivos. */
  token: string;
  /** El dueño, para el diálogo de compartir. */
  dueno: { nombre: string; avatar: string };
  /** El profe mirando el Drive de un alumno: se ve, pero no se toca. */
  soloLectura?: boolean;
  onCerrar?: () => void;
  /** Algo arriba de los archivos (las misiones). */
  arriba?: ReactNode;
  className?: string;
}

function leerVista(): Vista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'cuadricula';
  } catch {
    return 'cuadricula';
  }
}

/**
 * Simulador de Drive: barra lateral con "Nuevo", Mi unidad, Recientes, Destacados y Papelera; migas de pan,
 * cuadrícula o lista, menú de cada archivo (también con clic derecho), arrastrar archivos para subirlos y
 * arrastrar a una carpeta para moverlos. Sin logos ni nombres de marca.
 */
export function Drive({ drive, setDrive, token, dueno, soloLectura = false, onCerrar, arriba, className }: Props) {
  const [seccion, setSeccion] = useState<Seccion>('unidad');
  const [carpetaId, setCarpetaId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVistaEstado] = useState<Vista>(leerVista);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [nombrando, setNombrando] = useState<{ modo: 'carpeta' } | { modo: 'renombrar'; item: ItemDrive } | null>(null);
  const [compartiendo, setCompartiendo] = useState<ItemDrive | null>(null);
  const [moviendo, setMoviendo] = useState<ItemDrive | null>(null);
  const [previa, setPrevia] = useState<ItemDrive | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const [soltando, setSoltando] = useState(false);
  const contadorArrastre = useRef(0);
  const entrada = useRef<HTMLInputElement>(null);
  const tactil = useRef(false);
  /** En qué elemento empezó el toque: un "click" que no empezó ahí (por ejemplo, el que se cuela al cerrar un menú) no abre nada. */
  const presionado = useRef<number | null>(null);
  const { subidas, subir, cerrar: cerrarSubidas } = useSubidas(token, setDrive);

  const items = useMemo(() => drive?.items ?? [], [drive]);
  const porId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Si la carpeta abierta se borró o fue a la papelera, se vuelve a Mi unidad.
  useEffect(() => {
    if (carpetaId !== null && (!porId.get(carpetaId) || porId.get(carpetaId)!.enPapelera)) setCarpetaId(null);
  }, [carpetaId, porId]);

  const setVista = (v: Vista) => {
    setVistaEstado(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // sin almacenamiento: se usa la vista por defecto
    }
  };

  // --- qué se ve ---------------------------------------------------------------------------

  const buscando = busqueda.trim().length > 0;
  const visibles = useMemo(() => {
    const vivos = items.filter((i) => !i.enPapelera);
    if (buscando) {
      const q = busqueda.trim().toLowerCase();
      return ordenar(vivos.filter((i) => i.nombre.toLowerCase().includes(q)));
    }
    switch (seccion) {
      case 'unidad':
        return ordenar(vivos.filter((i) => i.padreId === carpetaId));
      case 'recientes':
        return vivos
          .filter((i) => i.tipo === 'archivo')
          .sort((a, b) => b.modificadoEn.localeCompare(a.modificadoEn) || b.id - a.id)
          .slice(0, 40);
      case 'destacados':
        return ordenar(vivos.filter((i) => i.destacado));
      case 'papelera':
        // Lo de adentro de una carpeta borrada no se lista aparte: viaja con ella.
        return ordenar(items.filter((i) => i.enPapelera && !(i.padreId !== null && porId.get(i.padreId)?.enPapelera)));
    }
  }, [items, porId, seccion, carpetaId, busqueda, buscando]);

  const enPapelera = seccion === 'papelera' && !buscando;
  const puedeEditar = !soloLectura && !enPapelera;
  const ruta = rutaHasta(items, carpetaId);
  // Solo cuenta si se está viendo: si se movió a otra carpeta o se borró, no queda una barra de acciones "fantasma".
  const seleccionado = seleccion !== null && visibles.some((v) => v.id === seleccion) ? (porId.get(seleccion) ?? null) : null;

  // --- acciones ----------------------------------------------------------------------------

  const pedir = useCallback(
    async (ruta: string, opciones: Parameters<typeof api>[1] = {}, exito?: string, deshacer?: () => void): Promise<boolean> => {
      try {
        setDrive(await api<MiDrive>(ruta, { ...opciones, token }));
        if (exito) toast(exito, deshacer ? { action: { label: 'Deshacer', onClick: deshacer } } : undefined);
        return true;
      } catch (e) {
        toast.error(mensajeDe(e));
        return false;
      }
    },
    [token, setDrive],
  );

  const cambiar = (item: ItemDrive, cambio: CambioDrive, exito?: string, deshacer?: () => void) =>
    pedir(`/drive/items/${item.id}`, { method: 'PATCH', body: cambio }, exito, deshacer);

  const abrir = (item: ItemDrive) => {
    if (item.enPapelera) return;
    if (item.tipo === 'carpeta') {
      setSeccion('unidad');
      setBusqueda('');
      setCarpetaId(item.id);
      setSeleccion(null);
    } else setPrevia(item);
  };

  const aPapelera = (item: ItemDrive) =>
    void pedir(
      `/drive/items/${item.id}/papelera`,
      { method: 'POST' },
      item.tipo === 'carpeta' ? 'Se movió la carpeta a la papelera' : 'Se movió el archivo a la papelera',
      () => void pedir(`/drive/items/${item.id}/restaurar`, { method: 'POST' }),
    ).then((ok) => ok && setSeleccion(null));

  const mover = (item: ItemDrive, destino: number | null) => {
    const anterior = item.padreId;
    const nombreDestino = destino === null ? 'Mi unidad' : (porId.get(destino)?.nombre ?? 'la carpeta');
    return cambiar(item, { padreId: destino }, `Se movió "${item.nombre}" a ${nombreDestino}`, () => void cambiar(item, { padreId: anterior }));
  };

  const descargar = (item: ItemDrive) => {
    const a = document.createElement('a');
    a.href = urlArchivo(item.id, token, true);
    a.download = item.nombre;
    document.body.append(a);
    a.click();
    a.remove();
  };

  const opcionesDe = (item: ItemDrive): OpcionMenu[] => {
    if (item.enPapelera) {
      if (soloLectura) return [];
      return [
        {
          clave: 'restaurar',
          texto: 'Restaurar',
          icono: RotateCcw,
          accion: () => void pedir(`/drive/items/${item.id}/restaurar`, { method: 'POST' }, `Se restauró "${item.nombre}"`),
        },
        {
          clave: 'borrar',
          texto: 'Eliminar definitivamente',
          icono: Trash2,
          destructiva: true,
          accion: () =>
            setConfirmacion({
              titulo: '¿Eliminar definitivamente?',
              descripcion: `"${item.nombre}" se va a borrar para siempre. No se puede deshacer.`,
              accion: 'Eliminar definitivamente',
              destructiva: true,
              onConfirmar: () => void pedir(`/drive/items/${item.id}`, { method: 'DELETE' }, 'Se eliminó para siempre'),
            }),
        },
      ];
    }
    const lista: OpcionMenu[] = [
      item.tipo === 'carpeta'
        ? { clave: 'abrir', texto: 'Abrir', icono: FolderInput, accion: () => abrir(item) }
        : { clave: 'abrir', texto: 'Vista previa', icono: Eye, accion: () => abrir(item) },
    ];
    if (item.tipo === 'archivo') lista.push({ clave: 'descargar', texto: 'Descargar', icono: Download, accion: () => descargar(item) });
    if (soloLectura) return lista;
    lista.push({ clave: 'renombrar', texto: 'Cambiar nombre', icono: Pencil, accion: () => setNombrando({ modo: 'renombrar', item }), separada: true });
    if (item.tipo === 'archivo') lista.push({ clave: 'compartir', texto: 'Compartir', icono: UserPlus, accion: () => setCompartiendo(item) });
    lista.push(
      { clave: 'mover', texto: 'Mover a…', icono: FolderInput, accion: () => setMoviendo(item) },
      item.destacado
        ? { clave: 'destacar', texto: 'Quitar de Destacados', icono: StarOff, accion: () => void cambiar(item, { destacado: false }, 'Se quitó de Destacados') }
        : { clave: 'destacar', texto: 'Agregar a Destacados', icono: Star, accion: () => void cambiar(item, { destacado: true }, 'Se agregó a Destacados') },
      { clave: 'papelera', texto: 'Mover a la papelera', icono: Trash2, accion: () => aPapelera(item), destructiva: true, separada: true },
    );
    return lista;
  };

  const elegirArchivos = () => entrada.current?.click();
  const nuevo = [
    { clave: 'carpeta', texto: 'Nueva carpeta', icono: FolderPlus, accion: () => setNombrando({ modo: 'carpeta' }) },
    { clave: 'subir', texto: 'Subir archivo', icono: Upload, accion: elegirArchivos, separada: true },
  ] satisfies OpcionMenu[];

  // Se sube a la carpeta abierta (en Recientes o Destacados, a Mi unidad).
  const destinoSubida = seccion === 'unidad' && !buscando ? carpetaId : null;

  // --- teclado y arrastre ------------------------------------------------------------------

  const teclas = (e: KeyboardEvent) => {
    if (!seleccionado || (e.target as HTMLElement).closest('input, textarea, button, [role="dialog"], [role="menu"]')) return;
    if (e.key === 'Enter') abrir(seleccionado);
    else if (e.key === 'Escape') setSeleccion(null);
    else if (puedeEditar && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      aPapelera(seleccionado);
    } else if (puedeEditar && e.key === 'F2') {
      e.preventDefault();
      setNombrando({ modo: 'renombrar', item: seleccionado });
    }
  };

  const traeArchivos = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const zonaSoltar = soloLectura
    ? {}
    : {
        onDragEnter: (e: DragEvent) => {
          if (!traeArchivos(e)) return;
          e.preventDefault();
          contadorArrastre.current++;
          setSoltando(true);
        },
        onDragOver: (e: DragEvent) => traeArchivos(e) && e.preventDefault(),
        onDragLeave: (e: DragEvent) => {
          if (!traeArchivos(e)) return;
          contadorArrastre.current = Math.max(0, contadorArrastre.current - 1);
          if (contadorArrastre.current === 0) setSoltando(false);
        },
        onDrop: (e: DragEvent) => {
          if (!traeArchivos(e)) return;
          e.preventDefault();
          contadorArrastre.current = 0;
          setSoltando(false);
          subir([...e.dataTransfer.files], destinoSubida);
        },
      };

  /** Una carpeta (o una miga) recibe lo que se le suelta: archivos de la compu o algo del mismo Drive. */
  const destinoArrastre = (destino: number | null) =>
    soloLectura
      ? {}
      : {
          onDragOver: (e: DragEvent) => {
            if (traeArchivos(e) || e.dataTransfer.types.includes(TIPO_ARRASTRE)) {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setAttribute('data-sobre', '');
            }
          },
          onDragLeave: (e: DragEvent) => e.currentTarget.removeAttribute('data-sobre'),
          onDrop: (e: DragEvent) => {
            e.currentTarget.removeAttribute('data-sobre');
            if (traeArchivos(e)) {
              e.preventDefault();
              e.stopPropagation();
              contadorArrastre.current = 0;
              setSoltando(false);
              subir([...e.dataTransfer.files], destino);
              return;
            }
            const id = Number(e.dataTransfer.getData(TIPO_ARRASTRE));
            const item = porId.get(id);
            if (!item || id === destino || item.padreId === destino) return;
            e.preventDefault();
            void mover(item, destino);
          },
        };

  // --- piezas ------------------------------------------------------------------------------

  const tocar = (item: ItemDrive) => {
    // En pantallas táctiles se abre con un toque; con mouse, un clic selecciona y doble clic abre (como en el real).
    // En pantallas angostas no hay barra de selección: un toque (o clic) abre siempre.
    if (tactil.current || window.matchMedia('(max-width: 767px)').matches) abrir(item);
    else setSeleccion(item.id);
  };

  const propsItem = (item: ItemDrive) => ({
    tabIndex: 0,
    'aria-selected': seleccion === item.id,
    // El menú ⋮ se dibuja en otro lado de la pantalla, pero en React sus eventos suben hasta la tarjeta:
    // solo cuenta lo que pasó adentro de la tarjeta de verdad.
    onPointerDown: (e: React.PointerEvent) => {
      if (!e.currentTarget.contains(e.target as Node)) return;
      tactil.current = e.pointerType === 'touch';
      presionado.current = item.id;
    },
    onClick: (e: React.MouseEvent) => {
      if (!e.currentTarget.contains(e.target as Node) || presionado.current !== item.id) return;
      presionado.current = null;
      tocar(item);
    },
    onDoubleClick: (e: React.MouseEvent) => e.currentTarget.contains(e.target as Node) && abrir(item),
    onFocus: (e: React.FocusEvent) => e.currentTarget.contains(e.target as Node) && setSeleccion(item.id),
    draggable: puedeEditar,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(TIPO_ARRASTRE, String(item.id));
      e.dataTransfer.effectAllowed = 'move';
    },
    ...(item.tipo === 'carpeta' && puedeEditar ? destinoArrastre(item.id) : {}),
  });

  const conMenu = (item: ItemDrive, hijo: ReactNode) => {
    const opciones = opcionesDe(item);
    if (opciones.length === 0) return hijo;
    return (
      <MenuContextual.Root onOpenChange={(a) => a && setSeleccion(item.id)}>
        <MenuContextual.Trigger asChild>{hijo}</MenuContextual.Trigger>
        <MenuContextual.Portal>
          <MenuContextual.Content className="z-50 w-max min-w-52 rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {opciones.map((o) => (
              <div key={o.clave}>
                {o.separada && <MenuContextual.Separator className="-mx-1 my-1 h-px bg-border" />}
                <MenuContextual.Item className={CLASE_ITEM_MENU} data-variant={o.destructiva ? 'destructive' : undefined} onSelect={o.accion}>
                  <o.icono />
                  {o.texto}
                </MenuContextual.Item>
              </div>
            ))}
          </MenuContextual.Content>
        </MenuContextual.Portal>
      </MenuContextual.Root>
    );
  };

  const botonMenu = (item: ItemDrive, className?: string) => {
    const opciones = opcionesDe(item);
    if (opciones.length === 0) return null;
    return (
      <DropdownMenu onOpenChange={(a) => a && setSeleccion(item.id)}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Más acciones para ${item.nombre}`}
            className={cn('shrink-0', className)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {opciones.map((o) => (
            <div key={o.clave}>
              {o.separada && <DropdownMenuSeparator />}
              <DropdownMenuItem variant={o.destructiva ? 'destructive' : 'default'} onSelect={o.accion}>
                <o.icono />
                {o.texto}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const marcas = (item: ItemDrive) => (
    <>
      {item.compartido && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Compartido con el profe" />}
      {item.destacado && <Star className="size-3.5 shrink-0 fill-current text-muted-foreground" aria-label="Destacado" />}
    </>
  );

  const ubicacion = (item: ItemDrive) => (item.padreId === null ? 'Mi unidad' : (porId.get(item.padreId)?.nombre ?? 'Mi unidad'));

  const carpetas = visibles.filter((i) => i.tipo === 'carpeta');
  const archivos = visibles.filter((i) => i.tipo === 'archivo');
  const tituloSeccion = buscando ? `Resultados de "${busqueda.trim()}"` : SECCIONES.find((s) => s.valor === seccion)!.nombre;
  const usados = drive?.usados ?? 0;
  const cuota = drive?.cuota ?? 1;

  const cuadricula = (
    <div className="flex flex-col gap-6">
      {carpetas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Carpetas</h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {carpetas.map((c) => (
              <li key={c.id}>
                {conMenu(
                  c,
                  <div
                    {...propsItem(c)}
                    className={cn(
                      'flex h-12 cursor-default items-center gap-3 rounded-xl bg-muted pr-1 pl-4 outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-sobre:bg-secondary data-sobre:ring-2 data-sobre:ring-pd-celeste',
                      seleccion === c.id && 'bg-secondary ring-2 ring-pd-celeste hover:bg-secondary',
                    )}
                  >
                    <IconoItem item={c} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nombre}</span>
                    {marcas(c)}
                    {botonMenu(c)}
                  </div>,
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {archivos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Archivos</h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
            {archivos.map((a) => (
              <li key={a.id}>
                {conMenu(
                  a,
                  <div
                    {...propsItem(a)}
                    className={cn(
                      'flex cursor-default flex-col overflow-hidden rounded-xl bg-muted outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
                      seleccion === a.id && 'bg-secondary ring-2 ring-pd-celeste hover:bg-secondary',
                    )}
                  >
                    <div className="flex items-center gap-2 py-1.5 pr-1 pl-3">
                      <IconoItem item={a} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.nombre}</span>
                      {botonMenu(a)}
                    </div>
                    <Miniatura item={a} token={token} />
                    {(a.compartido || a.destacado || buscando || seccion !== 'unidad') && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                        {marcas(a)}
                        {a.compartido && seccion === 'unidad' && !buscando && <span className="truncate">Compartido con el profe</span>}
                        {(buscando || seccion !== 'unidad') && <span className="truncate">{enPapelera ? 'En la papelera' : `En ${ubicacion(a)}`}</span>}
                      </div>
                    )}
                  </div>,
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const lista = (
    <div role="table" aria-label={tituloSeccion} className="flex flex-col">
      <div
        role="row"
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b px-3 py-2 text-sm font-semibold sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]"
      >
        <span role="columnheader">Nombre</span>
        <span role="columnheader" className="hidden sm:block">
          {enPapelera ? 'En la papelera' : 'Modificado'}
        </span>
        <span role="columnheader" className="hidden sm:block">
          Tamaño
        </span>
        <span className="w-8" />
      </div>
      {visibles.map((i) => (
        <div key={i.id}>
          {conMenu(
            i,
            <div
              role="row"
              {...propsItem(i)}
              className={cn(
                'grid cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-1 pr-1 pl-3 text-sm outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-sobre:bg-secondary sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]',
                seleccion === i.id && 'bg-secondary hover:bg-secondary',
              )}
            >
              <span role="cell" className="flex min-w-0 items-center gap-3">
                <IconoItem item={i} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{i.nombre}</span>
                  {(buscando || seccion === 'recientes' || seccion === 'destacados') && (
                    <span className="truncate text-xs text-muted-foreground">En {ubicacion(i)}</span>
                  )}
                </span>
                {marcas(i)}
              </span>
              <span role="cell" className="hidden text-muted-foreground sm:block">
                {fechaCorta(i.modificadoEn)}
              </span>
              <span role="cell" className="hidden text-muted-foreground sm:block">
                {i.tipo === 'carpeta' ? '—' : formatoTamano(i.tamano)}
              </span>
              {botonMenu(i) ?? <span className="w-8" />}
            </div>,
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col bg-card text-card-foreground', className)} onKeyDown={teclas}>
      {/* Encabezado: nombre, buscador y cerrar */}
      <header className="flex items-center gap-2 border-b px-3 py-2 sm:gap-4 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-pd-celeste-oscuro text-white">
            <HardDrive className="size-5" />
          </span>
          <span className="hidden text-xl font-semibold sm:block">Drive</span>
        </div>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-4 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring md:max-w-2xl">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en Drive"
            aria-label="Buscar en Drive"
            className="min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {buscando && (
            <button type="button" aria-label="Borrar la búsqueda" className="rounded-full p-1 hover:bg-foreground/10" onClick={() => setBusqueda('')}>
              <X className="size-4" />
            </button>
          )}
        </label>
        {onCerrar && (
          <Button variant="ghost" onClick={onCerrar} className="ml-auto shrink-0">
            <X data-icon="inline-start" />
            <span className="max-sm:sr-only">Cerrar</span>
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral (compu) */}
        <nav aria-label="Secciones del Drive" className="hidden w-60 shrink-0 flex-col gap-1 p-3 md:flex">
          {!soloLectura && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" variant="outline" className="mb-3 h-14 w-fit rounded-2xl bg-card pr-6 pl-4 text-base shadow-[var(--pd-sombra-tarjeta)]">
                  <Plus className="size-6" />
                  Nuevo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                {nuevo.map((o) => (
                  <div key={o.clave}>
                    {o.separada && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={o.accion}>
                      <o.icono />
                      {o.texto}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {SECCIONES.map(({ valor, nombre, icono: Icono }) => {
            const activa = seccion === valor && !buscando;
            return (
              <button
                key={valor}
                type="button"
                aria-current={activa ? 'page' : undefined}
                onClick={() => {
                  setSeccion(valor);
                  setCarpetaId(null);
                  setBusqueda('');
                  setSeleccion(null);
                }}
                {...(valor === 'unidad' ? destinoArrastre(null) : {})}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-full px-4 text-left text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-sobre:bg-secondary',
                  activa && 'bg-secondary font-bold hover:bg-secondary',
                )}
              >
                <Icono className="size-4" />
                {nombre}
              </button>
            );
          })}
          <div className="mt-4 flex flex-col gap-1.5 px-4">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-pd-celeste-oscuro" style={{ width: `${Math.min(100, Math.max(1, (usados / cuota) * 100))}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatoTamano(usados)} de {formatoTamano(cuota)} usados
            </p>
          </div>
        </nav>

        {/* Contenido */}
        <div
          data-zona-drive
          className="relative flex min-w-0 flex-1 flex-col overflow-y-auto md:mr-3 md:mb-3 md:overflow-hidden md:rounded-2xl md:bg-background"
          {...zonaSoltar}
        >
          {/* Secciones (celu) */}
          <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pt-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
            {SECCIONES.map(({ valor, nombre, icono: Icono }) => (
              <Button
                key={valor}
                size="sm"
                variant={seccion === valor && !buscando ? 'secondary' : 'outline'}
                className="shrink-0 rounded-full"
                onClick={() => {
                  setSeccion(valor);
                  setCarpetaId(null);
                  setBusqueda('');
                }}
              >
                <Icono data-icon="inline-start" />
                {nombre}
              </Button>
            ))}
          </div>

          {arriba}

          {/* Migas (siempre a la vista: también reciben lo que se arrastra) */}
          <div className="flex min-h-14 items-center gap-2 px-3 pt-2 sm:px-5 md:pb-0">
            {seccion === 'unidad' && !buscando ? (
              <nav aria-label="Ubicación" className="flex min-w-0 flex-1 items-center gap-0.5 text-lg sm:text-xl">
                {carpetaId !== null && (
                  <Button variant="ghost" size="icon-sm" aria-label="Volver" className="md:hidden" onClick={() => setCarpetaId(ruta.at(-2)?.id ?? null)}>
                    <ArrowLeft />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setCarpetaId(null)}
                  {...destinoArrastre(null)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 hover:bg-accent data-sobre:bg-secondary',
                    carpetaId !== null && 'max-md:hidden',
                    carpetaId === null && 'font-semibold',
                  )}
                >
                  Mi unidad
                </button>
                {ruta.map((c, i) => (
                  <span key={c.id} className={cn('flex min-w-0 items-center', i < ruta.length - 1 && 'max-md:hidden')}>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground max-md:hidden" />
                    <button
                      type="button"
                      onClick={() => setCarpetaId(c.id)}
                      {...destinoArrastre(c.id)}
                      className={cn('truncate rounded-full px-3 py-1 hover:bg-accent data-sobre:bg-secondary', i === ruta.length - 1 && 'font-semibold')}
                    >
                      {c.nombre}
                    </button>
                  </span>
                ))}
              </nav>
            ) : (
              <h2 className="min-w-0 flex-1 truncate px-3 text-lg font-semibold sm:text-xl">{tituloSeccion}</h2>
            )}
            {enPapelera && !soloLectura && visibles.length > 0 && (
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() =>
                  setConfirmacion({
                    titulo: '¿Vaciar la papelera?',
                    descripcion: 'Todo lo que está en la papelera se va a borrar para siempre. No se puede deshacer.',
                    accion: 'Vaciar la papelera',
                    destructiva: true,
                    onConfirmar: () => void pedir('/drive/papelera/vaciar', { method: 'POST' }, 'Se vació la papelera'),
                  })
                }
              >
                Vaciar la papelera
              </Button>
            )}
            <div className="flex shrink-0 rounded-full ring-1 ring-border" role="group" aria-label="Vista">
              <Button
                variant={vista === 'lista' ? 'secondary' : 'ghost'}
                size="icon-sm"
                className="rounded-l-full rounded-r-none"
                aria-label="Vista de lista"
                aria-pressed={vista === 'lista'}
                onClick={() => setVista('lista')}
              >
                <List />
              </Button>
              <Button
                variant={vista === 'cuadricula' ? 'secondary' : 'ghost'}
                size="icon-sm"
                className="rounded-l-none rounded-r-full"
                aria-label="Vista de cuadrícula"
                aria-pressed={vista === 'cuadricula'}
                onClick={() => setVista('cuadricula')}
              >
                <LayoutGrid />
              </Button>
            </div>
          </div>

          {/* Con mouse: la barra de acciones de lo seleccionado, en su propia fila de alto fijo. Así un clic no mueve
              nada de lugar (si se moviera, el segundo clic de un doble clic caería en otra cosa). */}
          <div className="hidden h-12 shrink-0 items-center px-3 sm:px-5 md:flex">
            {seleccionado && !tactil.current ? (
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted py-1 pr-2 pl-1">
                <Button variant="ghost" size="icon-sm" aria-label="Quitar la selección" onClick={() => setSeleccion(null)}>
                  <X />
                </Button>
                <span className="mr-2 truncate text-sm font-medium">1 seleccionado</span>
                {puedeEditar && seleccionado.tipo === 'archivo' && (
                  <Button variant="ghost" size="icon-sm" aria-label="Compartir" title="Compartir" onClick={() => setCompartiendo(seleccionado)}>
                    <UserPlus />
                  </Button>
                )}
                {seleccionado.tipo === 'archivo' && !seleccionado.enPapelera && (
                  <Button variant="ghost" size="icon-sm" aria-label="Descargar" title="Descargar" onClick={() => descargar(seleccionado)}>
                    <Download />
                  </Button>
                )}
                {puedeEditar && (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Mover" title="Mover" onClick={() => setMoviendo(seleccionado)}>
                      <FolderInput />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Mover a la papelera" title="Mover a la papelera" onClick={() => aPapelera(seleccionado)}>
                      <Trash2 />
                    </Button>
                  </>
                )}
                {botonMenu(seleccionado)}
              </div>
            ) : (
              <p className="px-3 text-sm text-muted-foreground">
                {visibles.length === 0
                  ? ''
                  : `${carpetas.length > 0 ? `${carpetas.length} ${carpetas.length === 1 ? 'carpeta' : 'carpetas'}` : ''}${carpetas.length > 0 && archivos.length > 0 ? ', ' : ''}${archivos.length > 0 ? `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'}` : ''}${puedeEditar ? '. Hacé clic para elegir, doble clic para abrir.' : ''}`}
              </p>
            )}
          </div>

          <div className="flex-1 px-3 pb-24 sm:px-5 md:min-h-0 md:overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setSeleccion(null)}>
            {drive === null ? (
              <p className="p-8 text-center text-muted-foreground">Cargando…</p>
            ) : visibles.length === 0 ? (
              <Vacio seccion={buscando ? 'busqueda' : seccion} enCarpeta={carpetaId !== null} soloLectura={soloLectura} onSubir={elegirArchivos} />
            ) : vista === 'cuadricula' ? (
              cuadricula
            ) : (
              lista
            )}
            {enPapelera && visibles.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Lo que está en la papelera se puede restaurar hasta que la vacíes.</p>
            )}
          </div>

          {/* Soltá para subir */}
          <AnimatePresence>
            {soltando && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center rounded-2xl bg-pd-celeste/15 p-8 ring-4 ring-pd-celeste ring-inset"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-3 rounded-2xl bg-pd-celeste-oscuro px-6 py-4 text-white shadow-[var(--pd-sombra-flotante)]">
                  <CloudUpload className="size-7" />
                  <span className="text-lg font-semibold">
                    Soltá los archivos para subirlos a <span className="font-extrabold">{ruta.at(-1)?.nombre ?? 'Mi unidad'}</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nuevo (celu) */}
          {!soloLectura && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-lg"
                  aria-label="Nuevo"
                  className={cn('fixed right-4 bottom-4 z-10 size-14 rounded-2xl shadow-[var(--pd-sombra-flotante)] md:hidden', subidas.length > 0 && 'hidden')}
                >
                  <Plus className="size-7" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="min-w-56">
                {nuevo.map((o) => (
                  <div key={o.clave}>
                    {o.separada && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={o.accion}>
                      <o.icono />
                      {o.texto}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <PanelSubidas subidas={subidas} onCerrar={cerrarSubidas} />
        </div>
      </div>

      <input
        ref={entrada}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          subir([...(e.target.files ?? [])], destinoSubida);
          e.target.value = '';
        }}
      />

      <DialogoNombre
        abierto={nombrando !== null}
        titulo={nombrando?.modo === 'renombrar' ? 'Cambiar nombre' : 'Nueva carpeta'}
        inicial={nombrando?.modo === 'renombrar' ? nombrando.item.nombre : 'Carpeta sin título'}
        boton={nombrando?.modo === 'renombrar' ? 'Aceptar' : 'Crear'}
        onCerrar={() => setNombrando(null)}
        onAceptar={(nombre) =>
          nombrando?.modo === 'renombrar'
            ? cambiar(nombrando.item, { nombre })
            : pedir('/drive/carpetas', { method: 'POST', body: { nombre, padreId: destinoSubida } }, `Se creó la carpeta "${nombre}"`)
        }
      />
      <DialogoCompartir
        item={compartiendo ? (porId.get(compartiendo.id) ?? null) : null}
        alumno={dueno}
        onCerrar={() => setCompartiendo(null)}
        onCompartir={(compartido) => cambiar(compartiendo!, { compartido }, compartido ? 'Se compartió con el profe' : 'El profe ya no tiene acceso')}
      />
      <DialogoMover item={moviendo} items={items} onCerrar={() => setMoviendo(null)} onMover={(destino) => mover(moviendo!, destino)} />
      <VistaPrevia item={previa} token={token} onCerrar={() => setPrevia(null)} />
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

function IconoItem({ item }: { item: ItemDrive }) {
  const { icono: Icono, color, tipo } = iconoDe(item);
  return <Icono className={cn('size-5 shrink-0', color, item.tipo === 'carpeta' && 'fill-current')} aria-label={tipo} />;
}

/** La miniatura del archivo: la imagen misma, o el ícono grande. */
function Miniatura({ item, token }: { item: ItemDrive; token: string }) {
  const [fallo, setFallo] = useState(false);
  const { icono: Icono, color } = iconoDe(item);
  return (
    <div className="mx-2 mb-2 grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-card">
      {item.mime?.startsWith('image/') && !fallo ? (
        <img src={urlArchivo(item.id, token)} alt="" loading="lazy" draggable={false} className="size-full object-cover" onError={() => setFallo(true)} />
      ) : (
        <Icono className={cn('size-14', color)} />
      )}
    </div>
  );
}

function Vacio({ seccion, enCarpeta, soloLectura, onSubir }: { seccion: Seccion | 'busqueda'; enCarpeta: boolean; soloLectura: boolean; onSubir: () => void }) {
  const textos: Record<Seccion | 'busqueda', [string, string]> = {
    unidad: enCarpeta
      ? ['La carpeta está vacía', 'Arrastrá archivos acá o usá el botón "Nuevo".']
      : ['Te damos la bienvenida a tu Drive', 'Acá se guardan tus archivos. Arrastralos a esta ventana o usá el botón "Nuevo" para subirlos.'],
    recientes: ['Todavía no hay archivos recientes', 'Lo que subas o cambies va a aparecer acá.'],
    destacados: ['No hay nada destacado', 'Destacá lo que uses seguido para encontrarlo rápido: menú ⋮ › Agregar a Destacados.'],
    papelera: ['La papelera está vacía', 'Lo que mandes a la papelera se puede recuperar hasta que la vacíes.'],
    busqueda: ['No se encontró nada', 'Probá con otra palabra.'],
  };
  const [titulo, texto] = textos[seccion];
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <CloudUpload className="size-16 text-pd-celeste" strokeWidth={1.5} />
      <p className="text-xl font-semibold">{soloLectura && seccion === 'unidad' ? 'No hay nada acá' : titulo}</p>
      {!soloLectura && <p className="max-w-md text-muted-foreground">{texto}</p>}
      {!soloLectura && seccion === 'unidad' && (
        <Button variant="outline" onClick={onSubir}>
          <Upload data-icon="inline-start" />
          Subir archivo
        </Button>
      )}
    </div>
  );
}

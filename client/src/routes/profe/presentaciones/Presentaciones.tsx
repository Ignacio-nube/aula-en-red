import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { motion } from 'motion/react';
import { EllipsisVertical, Eye, FileText, Pencil, Play, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITE_PDF_MB, type Presentacion } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { mensajeDe } from '@/lib/api';
import { CLAVES, leer } from '@/lib/almacen';
import { leerPdfLocal, portada, urlPresentacion } from '@/lib/pdf';
import { Confirmar, type PedidoConfirmacion } from '../Confirmar';
import { useProfe } from '../contexto';
import { DialogoTexto, type PedidoTexto } from '../Dialogos';
import { haceCuanto } from '../quizzes/ListaQuizzes';
import { VerPresentacion } from './VerPresentacion';

interface Subida {
  clave: number;
  nombre: string;
  /** null = leyendo el PDF; 0–100 = subiendo. */
  progreso: number | null;
}

/** "Clase 3 - Redes_v2.pdf" → "Clase 3 - Redes v2" */
function tituloDeArchivo(nombre: string): string {
  return (
    nombre
      .replace(/\.pdf$/i, '')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Presentación'
  );
}

/** fetch no informa el avance de una subida; XMLHttpRequest sí. */
function subirConProgreso(archivo: File, titulo: string, paginas: number, alAvanzar: (pct: number) => void): Promise<Presentacion> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/presentaciones?${new URLSearchParams({ titulo, paginas: String(paginas) })}`);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('Authorization', `Bearer ${leer(CLAVES.tokenProfe) ?? ''}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let datos: (Presentacion & { error?: string }) | null = null;
      try {
        datos = JSON.parse(xhr.responseText);
      } catch {
        // respuesta vacía
      }
      if (xhr.status >= 200 && xhr.status < 300 && datos) resolve(datos);
      else reject(new Error(datos?.error ?? 'No se pudo subir el PDF. Probá de nuevo.'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión mientras subía el PDF.'));
    xhr.send(archivo);
  });
}

export function Presentaciones() {
  const { pedir, irA, elegirPresentacion, presentacion: enVivo } = useProfe();
  const [lista, setLista] = useState<Presentacion[] | null>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [viendo, setViendo] = useState<Presentacion | null>(null);
  const [pedidoTexto, setPedidoTexto] = useState<PedidoTexto | null>(null);
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const claves = useRef(0);

  const cargar = useCallback(() => {
    pedir<Presentacion[]>('/presentaciones')
      .then(setLista)
      .catch((e) => toast.error(mensajeDe(e)));
  }, [pedir]);
  useEffect(cargar, [cargar]);

  const subirUno = async (archivo: File) => {
    const clave = ++claves.current;
    const cambiar = (progreso: number | null) => setSubidas((s) => s.map((x) => (x.clave === clave ? { ...x, progreso } : x)));
    setSubidas((s) => [...s, { clave, nombre: archivo.name, progreso: null }]);
    try {
      if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) throw new Error(`"${archivo.name}" no es un PDF.`);
      if (archivo.size > LIMITE_PDF_MB * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de ${LIMITE_PDF_MB} MB.`);
      let paginas: number;
      try {
        const leido = await leerPdfLocal(archivo);
        paginas = leido.paginas;
        leido.cerrar();
      } catch {
        throw new Error(`No se pudo abrir "${archivo.name}". ¿Es un PDF que se abre bien en la compu?`);
      }
      cambiar(0);
      const nueva = await subirConProgreso(archivo, tituloDeArchivo(archivo.name), paginas, cambiar);
      setLista((l) => [nueva, ...(l ?? [])]);
      toast.success(`Subiste "${nueva.titulo}"`);
    } catch (e) {
      toast.error(mensajeDe(e));
    } finally {
      setSubidas((s) => s.filter((x) => x.clave !== clave));
    }
  };

  const subir = async (archivos: FileList | File[]) => {
    // De a uno: con dos PDFs pesados a la vez, ninguno avanza.
    for (const a of Array.from(archivos)) await subirUno(a);
  };

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files.length > 0) void subir(e.dataTransfer.files);
  };

  const presentar = (p: Presentacion) => {
    elegirPresentacion(p.id);
    irA('clase');
  };

  const renombrar = (p: Presentacion) =>
    setPedidoTexto({
      titulo: 'Cambiar el título',
      etiqueta: 'Título',
      inicial: p.titulo,
      accion: 'Guardar',
      max: 80,
      onGuardar: async (titulo) => {
        const nueva = await pedir<Presentacion>(`/presentaciones/${p.id}`, { method: 'PATCH', body: { titulo } });
        setLista((l) => l?.map((x) => (x.id === p.id ? nueva : x)) ?? null);
      },
    });

  const borrar = (p: Presentacion) =>
    setConfirmacion({
      titulo: `¿Borrar "${p.titulo}"?`,
      descripcion: 'Se borra el PDF de la compu. Si lo necesitás de nuevo, lo vas a tener que volver a subir.',
      accion: 'Borrar presentación',
      destructiva: true,
      onConfirmar: async () => {
        try {
          await pedir(`/presentaciones/${p.id}`, { method: 'DELETE' });
          setLista((l) => l?.filter((x) => x.id !== p.id) ?? null);
        } catch (e) {
          toast.error(mensajeDe(e));
        }
      },
    });

  const botonSubir = (
    <Button onClick={() => entrada.current?.click()}>
      <Upload data-icon="inline-start" />
      Subir PDF
    </Button>
  );

  return (
    <div
      className="relative flex min-h-[60vh] flex-col gap-5"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false);
      }}
      onDrop={alSoltar}
    >
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void subir(e.target.files);
          e.target.value = '';
        }}
      />

      {lista !== null && lista.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Presentaciones</h2>
            <p className="text-sm text-muted-foreground">Para usar una de PowerPoint: Archivo → Exportar → PDF. También podés arrastrar los PDFs acá.</p>
          </div>
          {botonSubir}
        </div>
      )}

      {subidas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {subidas.map((s) => (
            <li key={s.clave} className="flex items-center gap-4 rounded-2xl bg-card px-4 py-3 shadow-[var(--pd-sombra-tarjeta)]">
              <FileText className="size-5 text-pd-celeste-oscuro" />
              <span className="min-w-0 flex-1 truncate font-medium">{s.nombre}</span>
              <span className="w-28 text-right text-sm text-muted-foreground tabular-nums">
                {s.progreso === null ? 'Leyendo el PDF…' : s.progreso < 100 ? `Subiendo ${s.progreso}%` : 'Guardando…'}
              </span>
              <Progress value={s.progreso ?? 0} className="h-2 w-40" />
            </li>
          ))}
        </ul>
      )}

      {lista === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-3xl" />
          ))}
        </div>
      ) : lista.length === 0 && subidas.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Subí tu primera presentación</EmptyTitle>
              <EmptyDescription>
                Guardá tus diapositivas como PDF (en PowerPoint: Archivo → Exportar → PDF) y arrastralas acá. Quedan guardadas en esta compu
                para usarlas cuando quieras.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{botonSubir}</EmptyContent>
          </Empty>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lista.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: Math.min(i, 8) * 0.03 }}
            >
              <TarjetaPresentacion
                p={p}
                enVivo={enVivo?.presentacionId === p.id}
                onVer={() => setViendo(p)}
                onPresentar={() => presentar(p)}
                onRenombrar={() => renombrar(p)}
                onBorrar={() => borrar(p)}
              />
            </motion.li>
          ))}
        </ul>
      )}

      {arrastrando && (
        <div className="pointer-events-none absolute -inset-2 z-10 grid place-items-center rounded-3xl border-2 border-dashed border-pd-celeste bg-pd-celeste-claro/80">
          <p className="flex items-center gap-2 text-xl font-bold text-pd-celeste-oscuro">
            <Upload className="size-6" />
            Soltá los PDFs para subirlos
          </p>
        </div>
      )}

      <VerPresentacion
        presentacion={viendo}
        onCerrar={() => setViendo(null)}
        onPresentar={(p) => {
          setViendo(null);
          presentar(p);
        }}
      />
      <DialogoTexto pedido={pedidoTexto} onCerrar={() => setPedidoTexto(null)} />
      <Confirmar pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

function TarjetaPresentacion({
  p,
  enVivo,
  onVer,
  onPresentar,
  onRenombrar,
  onBorrar,
}: {
  p: Presentacion;
  enVivo: boolean;
  onVer: () => void;
  onPresentar: () => void;
  onRenombrar: () => void;
  onBorrar: () => void;
}) {
  const [imagen, setImagen] = useState<string | null>(null);
  const [sinPortada, setSinPortada] = useState(false);
  const marco = useRef<HTMLButtonElement>(null);
  // La portada se dibuja recién cuando la tarjeta aparece en pantalla.
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    let vivo = true;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      io.disconnect();
      portada(urlPresentacion(p.archivo)).then(
        (src) => vivo && setImagen(src),
        () => vivo && setSinPortada(true),
      );
    });
    io.observe(el);
    return () => {
      vivo = false;
      io.disconnect();
    };
  }, [p.archivo]);

  return (
    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-[var(--pd-sombra-flotante)]">
      <button
        ref={marco}
        type="button"
        onClick={onVer}
        aria-label={`Ver ${p.titulo}`}
        className="relative grid aspect-video w-full place-items-center bg-muted p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        {imagen ? (
          <img src={imagen} alt="" className="mx-auto max-h-full max-w-full rounded-md object-contain shadow-sm" />
        ) : sinPortada ? (
          <FileText className="mx-auto size-10 text-muted-foreground" />
        ) : (
          <Skeleton className="mx-auto h-full w-3/4 rounded-md" />
        )}
        {enVivo && (
          <span className="absolute top-2 left-2 rounded-full bg-pd-resp-b px-2.5 py-0.5 text-xs font-bold text-white">En vivo</span>
        )}
      </button>
      <div className="flex items-start gap-2 px-4 pt-3 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-bold">{p.titulo}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {p.paginas === 1 ? '1 diapositiva' : `${p.paginas} diapositivas`}, subida {haceCuanto(p.creadoEn)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${p.titulo}`}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onPresentar}>
                <Play />
                Presentar en clase
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onVer}>
                <Eye />
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onRenombrar}>
                <Pencil />
                Cambiar el título
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={onBorrar}>
                <Trash2 />
                Borrar
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

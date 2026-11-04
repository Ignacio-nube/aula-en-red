import { useCallback, useEffect, useState } from 'react';
import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, Presentation, type LucideIcon } from 'lucide-react';
import { LIMITES_DRIVE, type ItemDrive, type MiDrive } from '@aula/shared';
import { ErrorApi, api, mensajeDe } from './api';
import { prepararImagen } from './imagen';
import type { SocketAula } from './socket';

/** Dirección del archivo (con el token en la URL: la pide un <img> o un link). */
export function urlArchivo(id: number, token: string, descargar = false): string {
  return `/api/drive/archivo/${id}?t=${encodeURIComponent(token)}${descargar ? '&descargar=1' : ''}`;
}

/** El Drive de un alumno: se carga entero y se vuelve a pedir si el profe lo vacía. */
export function useMiDrive(token: string, socket: SocketAula | null) {
  const [drive, setDrive] = useState<MiDrive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setDrive(await api<MiDrive>('/drive', { token }));
      setError(null);
    } catch (e) {
      setError(mensajeDe(e));
    }
  }, [token]);
  useEffect(() => void recargar(), [recargar]);
  useEffect(() => {
    if (!socket) return;
    const alCambio = () => void recargar();
    socket.on('drive:cambio', alCambio);
    socket.on('connect', alCambio);
    return () => {
      socket.off('drive:cambio', alCambio);
      socket.off('connect', alCambio);
    };
  }, [socket, recargar]);
  return { drive, setDrive, error, recargar };
}

/**
 * Sube un archivo con su barra de progreso (fetch no la tiene: va con XMLHttpRequest).
 * Viaja crudo, con el nombre y el tipo en headers. Las fotos pesadas se achican antes.
 */
export function subirArchivo(
  archivo: File,
  padreId: number | null,
  token: string,
  onProgreso: (fraccion: number) => void,
): { promesa: Promise<MiDrive>; cancelar: () => void } {
  const xhr = new XMLHttpRequest();
  let cancelado = false;
  const promesa = (async () => {
    let cuerpo: Blob = archivo;
    let tipo = archivo.type || 'application/octet-stream';
    if (archivo.type.startsWith('image/') && archivo.type !== 'image/gif' && archivo.size > 1.5 * 1024 * 1024) {
      cuerpo = await prepararImagen(archivo).catch(() => archivo);
      tipo = cuerpo.type || tipo;
    }
    if (cuerpo.size > LIMITES_DRIVE.archivoBytes) throw new ErrorApi('Es demasiado pesado (máximo 10 MB).', 413);
    if (cancelado) throw new ErrorApi('Cancelado', 0);
    return new Promise<MiDrive>((resolver, rechazar) => {
      xhr.open('POST', `/api/drive/archivos${padreId !== null ? `?padre=${padreId}` : ''}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Nombre', encodeURIComponent(archivo.name || 'Archivo sin título'));
      xhr.setRequestHeader('X-Tipo', tipo);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgreso(e.loaded / e.total);
      xhr.onload = () => {
        let datos: (MiDrive & { error?: string }) | null = null;
        try {
          datos = JSON.parse(xhr.responseText);
        } catch {
          // sin cuerpo
        }
        if (xhr.status >= 200 && xhr.status < 300 && datos) resolver(datos);
        else rechazar(new ErrorApi(datos?.error ?? 'No se pudo subir. Probá de nuevo.', xhr.status));
      };
      xhr.onerror = () => rechazar(new ErrorApi('Se cortó la conexión mientras se subía.', 0));
      xhr.onabort = () => rechazar(new ErrorApi('Cancelado', 0));
      xhr.send(cuerpo);
    });
  })();
  return {
    promesa,
    cancelar: () => {
      cancelado = true;
      xhr.abort();
    },
  };
}

interface Icono {
  icono: LucideIcon;
  /** Color del ícono (como en el Drive real: rojo PDF, verde planillas…). */
  color: string;
  tipo: string;
}

/** Ícono, color y nombre del tipo de archivo, por su tipo MIME o su extensión. */
export function iconoDe(item: Pick<ItemDrive, 'tipo' | 'mime' | 'nombre'>): Icono {
  if (item.tipo === 'carpeta') return { icono: Folder, color: 'text-muted-foreground', tipo: 'Carpeta' };
  const m = item.mime ?? '';
  const ext = /\.([a-z0-9]+)$/i.exec(item.nombre)?.[1]?.toLowerCase() ?? '';
  if (m.startsWith('image/')) return { icono: FileImage, color: 'text-[#d93025] dark:text-[#f28b82]', tipo: 'Imagen' };
  if (m === 'application/pdf' || ext === 'pdf') return { icono: FileText, color: 'text-[#d93025] dark:text-[#f28b82]', tipo: 'PDF' };
  if (m.startsWith('video/')) return { icono: FileVideo, color: 'text-[#d93025] dark:text-[#f28b82]', tipo: 'Video' };
  if (m.startsWith('audio/')) return { icono: FileAudio, color: 'text-[#d93025] dark:text-[#f28b82]', tipo: 'Audio' };
  if (/sheet|excel|csv/.test(m) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext))
    return { icono: FileSpreadsheet, color: 'text-[#188038] dark:text-[#81c995]', tipo: 'Hoja de cálculo' };
  if (/presentation|powerpoint/.test(m) || ['ppt', 'pptx', 'odp'].includes(ext))
    return { icono: Presentation, color: 'text-[#e37400] dark:text-[#fdd663]', tipo: 'Presentación' };
  if (/word|opendocument\.text|rtf/.test(m) || ['doc', 'docx', 'odt', 'rtf'].includes(ext))
    return { icono: FileText, color: 'text-[#1a73e8] dark:text-[#8ab4f8]', tipo: 'Documento' };
  if (/zip|compressed|rar|7z|tar/.test(m) || ['zip', 'rar', '7z'].includes(ext))
    return { icono: FileArchive, color: 'text-muted-foreground', tipo: 'Archivo comprimido' };
  if (m.startsWith('text/')) return { icono: FileText, color: 'text-[#1a73e8] dark:text-[#8ab4f8]', tipo: 'Texto' };
  return { icono: File, color: 'text-muted-foreground', tipo: 'Archivo' };
}

/** "hace un momento", "14:32", "3 nov". La fecha viene de SQLite en UTC. */
export function fechaCorta(sqlite: string): string {
  const d = new Date(sqlite.includes('T') ? sqlite : `${sqlite.replace(' ', 'T')}Z`);
  const ahora = new Date();
  if (ahora.getTime() - d.getTime() < 60_000) return 'hace un momento';
  if (d.toDateString() === ahora.toDateString()) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== ahora.getFullYear() && { year: 'numeric' }) });
}

/** Carpetas desde Mi unidad hasta esta (incluida). */
export function rutaHasta(items: ItemDrive[], carpetaId: number | null): ItemDrive[] {
  const porId = new Map(items.map((i) => [i.id, i]));
  const ruta: ItemDrive[] = [];
  let actual = carpetaId !== null ? porId.get(carpetaId) : undefined;
  while (actual && ruta.length < 50) {
    ruta.unshift(actual);
    actual = actual.padreId !== null ? porId.get(actual.padreId) : undefined;
  }
  return ruta;
}

/** Carpetas primero; después por nombre. */
export function ordenar(items: ItemDrive[]): ItemDrive[] {
  return [...items].sort(
    (a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'carpeta' ? -1 : 1) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }),
  );
}

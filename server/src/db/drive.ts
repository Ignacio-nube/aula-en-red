import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LIMITES_DRIVE, type CambioDrive, type EventoDrive, type ItemDrive, type MiDrive } from '@aula/shared';
import { DRIVE_DIR } from '../paths';
import { db } from './index';

export interface FilaItem {
  id: number;
  alumno_id: number;
  padre_id: number | null;
  tipo: 'carpeta' | 'archivo';
  nombre: string;
  mime: string | null;
  tamano: number;
  archivo: string | null;
  destacado: number;
  compartido: number;
  en_papelera_desde: string | null;
  creado_en: string;
  modificado_en: string;
}

export const aItem = (f: FilaItem): ItemDrive => ({
  id: f.id,
  padreId: f.padre_id,
  tipo: f.tipo,
  nombre: f.nombre,
  mime: f.mime,
  tamano: f.tamano,
  destacado: f.destacado === 1,
  compartido: f.compartido === 1,
  enPapelera: f.en_papelera_desde !== null,
  creadoEn: f.creado_en,
  modificadoEn: f.modificado_en,
});

export function filasDe(alumnoId: number): FilaItem[] {
  return db.prepare<[number], FilaItem>('SELECT * FROM drive_items WHERE alumno_id = ? ORDER BY id').all(alumnoId);
}

export function driveDe(alumnoId: number): MiDrive {
  const filas = filasDe(alumnoId);
  return { items: filas.map(aItem), usados: filas.reduce((a, f) => a + f.tamano, 0), cuota: LIMITES_DRIVE.cuotaBytes };
}

export function buscarItem(id: number): FilaItem | undefined {
  return db.prepare<[number], FilaItem>('SELECT * FROM drive_items WHERE id = ?').get(id);
}

export const rutaArchivo = (alumnoId: number, archivo: string) => path.join(DRIVE_DIR, String(alumnoId), archivo);

/** Resultado de una operación: el Drive actualizado y qué pasó (para las misiones), o un error. */
export type Resultado = { ok: true; evento: EventoDrive | null; item?: FilaItem } | { ok: false; status: number; error: string };

const mal = (error: string, status = 400): Resultado => ({ ok: false, status, error });

/** Nombre válido para una carpeta o un archivo, o null. */
export function nombreValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  // Sin caracteres de control ni barras: es el nombre que se ve, no una ruta.
  const n = valor
    .replace(/[\u0000-\u001f\u007f/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n.length > 0 && n.length <= LIMITES_DRIVE.nombre ? n : null;
}

/** La carpeta de destino tiene que ser del alumno, una carpeta y no estar en la papelera. */
function carpetaDestino(alumnoId: number, padreId: unknown): { ok: true; id: number | null } | { ok: false; error: string } {
  if (padreId === null || padreId === undefined) return { ok: true, id: null };
  const p = buscarItem(Number(padreId));
  if (!p || p.alumno_id !== alumnoId || p.tipo !== 'carpeta' || p.en_papelera_desde !== null) return { ok: false, error: 'Esa carpeta no existe.' };
  return { ok: true, id: p.id };
}

function cantidad(alumnoId: number): number {
  return db.prepare<[number], { n: number }>('SELECT COUNT(*) AS n FROM drive_items WHERE alumno_id = ?').get(alumnoId)!.n;
}

export function crearCarpeta(alumnoId: number, nombre: unknown, padreId: unknown): Resultado {
  const n = nombreValido(nombre);
  if (!n) return mal(`Poné un nombre de hasta ${LIMITES_DRIVE.nombre} letras.`);
  const destino = carpetaDestino(alumnoId, padreId);
  if (!destino.ok) return mal(destino.error, 404);
  if (cantidad(alumnoId) >= LIMITES_DRIVE.items) return mal('Tu Drive ya tiene demasiadas cosas. Borrá algo antes.');
  const { lastInsertRowid } = db
    .prepare("INSERT INTO drive_items (alumno_id, padre_id, tipo, nombre) VALUES (?, ?, 'carpeta', ?)")
    .run(alumnoId, destino.id, n);
  return { ok: true, evento: 'carpeta', item: buscarItem(Number(lastInsertRowid)) };
}

/** Extensiones conocidas, para guardar el archivo en disco con una que no engañe al navegador. */
const EXTENSIONES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

/** Los nombres de archivo muy largos (comunes en descargas) se recortan dejando la extensión, en vez de rechazarlos. */
export function recortarNombre(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const limpio = valor.replace(/\s+/g, ' ').trim();
  if (limpio.length <= LIMITES_DRIVE.nombre) return limpio;
  const ext = /\.[a-z0-9]{1,8}$/i.exec(limpio)?.[0] ?? '';
  return `${limpio.slice(0, LIMITES_DRIVE.nombre - ext.length - 1).trimEnd()}…${ext}`;
}

export function subirArchivo(alumnoId: number, nombre: unknown, mimeCrudo: unknown, datos: Buffer, padreId: unknown): Resultado {
  const n = nombreValido(recortarNombre(nombre));
  if (!n) return mal('El archivo no tiene un nombre válido.');
  if (datos.length === 0) return mal('El archivo está vacío.');
  if (datos.length > LIMITES_DRIVE.archivoBytes) return mal('El archivo es demasiado pesado (máximo 10 MB).', 413);
  const destino = carpetaDestino(alumnoId, padreId);
  if (!destino.ok) return mal(destino.error, 404);
  if (cantidad(alumnoId) >= LIMITES_DRIVE.items) return mal('Tu Drive ya tiene demasiadas cosas. Borrá algo antes.');
  const usados = driveDe(alumnoId).usados;
  if (usados + datos.length > LIMITES_DRIVE.cuotaBytes) return mal('Te quedaste sin espacio. Vaciá la papelera o borrá algo.', 413);

  // El tipo lo dice el navegador; solo se guarda si tiene forma de tipo MIME.
  const mime = typeof mimeCrudo === 'string' && /^[a-z]+\/[a-z0-9.+-]+$/i.test(mimeCrudo) ? mimeCrudo.toLowerCase() : 'application/octet-stream';
  const archivo = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${EXTENSIONES[mime] ?? 'bin'}`;
  mkdirSync(path.join(DRIVE_DIR, String(alumnoId)), { recursive: true });
  writeFileSync(rutaArchivo(alumnoId, archivo), datos);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO drive_items (alumno_id, padre_id, tipo, nombre, mime, tamano, archivo) VALUES (?, ?, 'archivo', ?, ?, ?, ?)")
    .run(alumnoId, destino.id, n, mime, datos.length, archivo);
  return { ok: true, evento: 'subir', item: buscarItem(Number(lastInsertRowid)) };
}

/** Ids de la carpeta y todo lo que tiene adentro (a cualquier profundidad). */
function conDescendientes(alumnoId: number, id: number): number[] {
  const filas = filasDe(alumnoId);
  const ids = [id];
  for (let i = 0; i < ids.length; i++) for (const f of filas) if (f.padre_id === ids[i]) ids.push(f.id);
  return ids;
}

function itemDe(alumnoId: number, id: number): FilaItem | null {
  const f = buscarItem(id);
  return f && f.alumno_id === alumnoId ? f : null;
}

/** Renombrar, mover, destacar o compartir. Una cosa por vez, como en el Drive real. */
export function cambiarItem(alumnoId: number, id: number, cambio: CambioDrive): Resultado {
  const f = itemDe(alumnoId, id);
  if (!f) return mal('Ese archivo no existe.', 404);
  if (f.en_papelera_desde !== null) return mal('Está en la papelera. Restauralo primero.');

  if (cambio.nombre !== undefined) {
    const n = nombreValido(cambio.nombre);
    if (!n) return mal(`Poné un nombre de hasta ${LIMITES_DRIVE.nombre} letras.`);
    db.prepare("UPDATE drive_items SET nombre = ?, modificado_en = datetime('now') WHERE id = ?").run(n, id);
    return { ok: true, evento: n === f.nombre ? null : 'renombrar', item: buscarItem(id) };
  }
  if (cambio.padreId !== undefined) {
    const destino = carpetaDestino(alumnoId, cambio.padreId);
    if (!destino.ok) return mal(destino.error, 404);
    if (destino.id !== null && f.tipo === 'carpeta' && conDescendientes(alumnoId, id).includes(destino.id)) {
      return mal('No se puede mover una carpeta adentro de sí misma.');
    }
    db.prepare('UPDATE drive_items SET padre_id = ? WHERE id = ?').run(destino.id, id);
    return { ok: true, evento: destino.id === f.padre_id ? null : 'mover', item: buscarItem(id) };
  }
  if (cambio.destacado !== undefined) {
    db.prepare('UPDATE drive_items SET destacado = ? WHERE id = ?').run(cambio.destacado ? 1 : 0, id);
    return { ok: true, evento: cambio.destacado ? 'destacar' : null, item: buscarItem(id) };
  }
  if (cambio.compartido !== undefined) {
    db.prepare('UPDATE drive_items SET compartido = ? WHERE id = ?').run(cambio.compartido ? 1 : 0, id);
    return { ok: true, evento: cambio.compartido ? 'compartir' : null, item: buscarItem(id) };
  }
  return mal('No hay nada que cambiar.');
}

/** A la papelera va la carpeta con todo lo de adentro, con la misma marca de tiempo para poder restaurarlo junto. */
export function aPapelera(alumnoId: number, id: number): Resultado {
  const f = itemDe(alumnoId, id);
  if (!f) return mal('Ese archivo no existe.', 404);
  if (f.en_papelera_desde !== null) return { ok: true, evento: null, item: f };
  const ids = conDescendientes(alumnoId, id);
  const marca = new Date().toISOString();
  const upd = db.prepare('UPDATE drive_items SET en_papelera_desde = ? WHERE id = ? AND en_papelera_desde IS NULL');
  db.transaction(() => ids.forEach((i) => upd.run(marca, i)))();
  return { ok: true, evento: 'papelera', item: buscarItem(id) };
}

export function restaurar(alumnoId: number, id: number): Resultado {
  const f = itemDe(alumnoId, id);
  if (!f) return mal('Ese archivo no existe.', 404);
  if (f.en_papelera_desde === null) return { ok: true, evento: null, item: f };
  const marca = f.en_papelera_desde;
  const ids = conDescendientes(alumnoId, id);
  // Si la carpeta en la que estaba sigue en la papelera, vuelve a Mi unidad (como en el real).
  const padre = f.padre_id !== null ? buscarItem(f.padre_id) : undefined;
  const nuevoPadre = padre && padre.en_papelera_desde === null ? padre.id : null;
  const upd = db.prepare('UPDATE drive_items SET en_papelera_desde = NULL WHERE id = ? AND en_papelera_desde = ?');
  db.transaction(() => {
    ids.forEach((i) => upd.run(i, marca));
    db.prepare('UPDATE drive_items SET padre_id = ? WHERE id = ?').run(nuevoPadre, id);
  })();
  return { ok: true, evento: 'restaurar', item: buscarItem(id) };
}

function borrarFilas(filas: FilaItem[]): void {
  const del = db.prepare('DELETE FROM drive_items WHERE id = ?');
  db.transaction(() => filas.forEach((f) => del.run(f.id)))();
  for (const f of filas) {
    if (!f.archivo) continue;
    try {
      unlinkSync(rutaArchivo(f.alumno_id, f.archivo));
    } catch {
      // Ya no estaba: no importa.
    }
  }
}

/** Borra para siempre algo que está en la papelera (con lo que tenga adentro). */
export function borrarDefinitivo(alumnoId: number, id: number): Resultado {
  const f = itemDe(alumnoId, id);
  if (!f) return mal('Ese archivo no existe.', 404);
  if (f.en_papelera_desde === null) return mal('Primero mandalo a la papelera.');
  const ids = new Set(conDescendientes(alumnoId, id));
  borrarFilas(filasDe(alumnoId).filter((x) => ids.has(x.id)));
  return { ok: true, evento: 'borrar' };
}

export function vaciarPapelera(alumnoId: number): Resultado {
  borrarFilas(filasDe(alumnoId).filter((f) => f.en_papelera_desde !== null));
  return { ok: true, evento: 'borrar' };
}

/** Lo usa el profe: deja el Drive del alumno vacío. */
export function vaciarDrive(alumnoId: number): void {
  db.prepare('DELETE FROM drive_items WHERE alumno_id = ?').run(alumnoId);
  rmSync(path.join(DRIVE_DIR, String(alumnoId)), { recursive: true, force: true });
}

/** Al arrancar: borra las carpetas de alumnos que ya no existen (se borraron desde Comisiones). */
export function limpiarDrivesHuerfanos(): void {
  if (!existsSync(DRIVE_DIR)) return;
  const existe = db.prepare<[number], { id: number }>('SELECT id FROM alumnos WHERE id = ?');
  for (const nombre of readdirSync(DRIVE_DIR)) {
    const id = Number(nombre);
    if (Number.isInteger(id) && !existe.get(id)) rmSync(path.join(DRIVE_DIR, nombre), { recursive: true, force: true });
  }
}

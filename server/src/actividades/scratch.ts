import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  LIMITES_SCRATCH,
  type Ack,
  type AccionScratch,
  type EntregaScratch,
  type OpcionesScratch,
  type RolSocket,
  type VistaScratch,
} from '@aula/shared';
import { db } from '../db';
import { SCRATCH_DATOS_DIR } from '../paths';
import type { ContextoActividad, InstanciaActividad, ModuloActividad } from './tipos';

// --- archivos ------------------------------------------------------------------------------

/** Un .sb3 es un ZIP: empieza con "PK\x03\x04". */
export function esSb3(datos: Buffer): boolean {
  return datos.length >= 4 && datos[0] === 0x50 && datos[1] === 0x4b && datos[2] === 0x03 && datos[3] === 0x04;
}

/** Los nombres son al azar: la URL sirve de llave para el editor y la pantalla, que no tienen token. */
export const NOMBRE_PROYECTO = /^[a-z]\d*-[a-f0-9]{16}\.sb3$/;

function nombreNuevo(prefijo: string): string {
  return `${prefijo}-${randomBytes(8).toString('hex')}.sb3`;
}

export function rutaProyecto(archivo: string): string {
  return path.join(SCRATCH_DATOS_DIR, archivo);
}

export const urlProyecto = (archivo: string) => `/api/scratch/proyectos/${archivo}`;

export function guardarProyecto(prefijo: string, datos: Buffer): string {
  const archivo = nombreNuevo(prefijo);
  writeFileSync(rutaProyecto(archivo), datos);
  return archivo;
}

export function borrarProyecto(archivo: string | null | undefined): void {
  if (!archivo) return;
  try {
    unlinkSync(rutaProyecto(archivo));
  } catch {
    // ya no estaba
  }
}

/** SQLite guarda "2026-11-21 14:32:05" en UTC: lo pasamos a ISO para que el navegador lo muestre en su hora. */
export const isoDe = (sqlite: string) => `${sqlite.replace(' ', 'T')}Z`;

// --- el taller -----------------------------------------------------------------------------

interface Entrega {
  archivo: string;
  bytes: number;
  veces: number;
  entregadaEn: string;
}

interface Alumno {
  id: number;
  nombre: string;
  avatar: string;
}

interface TallerGuardado {
  tallerId: number;
  mostrando: number | null;
}

class TallerScratch implements InstanciaActividad<'scratch'> {
  readonly tipo = 'scratch';
  private readonly entregas = new Map<number, Entrega>();

  constructor(
    private readonly ctx: ContextoActividad,
    private readonly tallerId: number,
    private readonly titulo: string,
    private readonly inicial: { nombre: string; archivo: string } | null,
    private mostrando: number | null = null,
  ) {
    const filas = db
      .prepare<[number], { alumno_id: number; archivo: string; bytes: number; veces: number; entregada_en: string }>(
        'SELECT alumno_id, archivo, bytes, veces, entregada_en FROM scratch_entregas WHERE taller_id = ?',
      )
      .all(tallerId);
    for (const f of filas) this.entregas.set(f.alumno_id, { archivo: f.archivo, bytes: f.bytes, veces: f.veces, entregadaEn: isoDe(f.entregada_en) });
    if (this.mostrando !== null && !this.entregas.has(this.mostrando)) this.mostrando = null;
  }

  guardar(): TallerGuardado {
    return { tallerId: this.tallerId, mostrando: this.mostrando };
  }

  /** La entrega llega por HTTP (un .sb3 no entra cómodo en un mensaje del socket). Reemplaza la anterior. */
  entregar(alumnoId: number, datos: Buffer): Ack {
    const alumno = db.prepare<[number], { comision_id: number }>('SELECT comision_id FROM alumnos WHERE id = ?').get(alumnoId);
    if (alumno?.comision_id !== this.ctx.comisionId) return { ok: false, error: 'Este taller es de otra comisión.' };
    const anterior = this.entregas.get(alumnoId);
    const archivo = guardarProyecto(`e${this.tallerId}`, datos);
    try {
      const fila = db
        .prepare<[number, number, string, number], { veces: number; entregada_en: string }>(
          `INSERT INTO scratch_entregas (taller_id, alumno_id, archivo, bytes) VALUES (?, ?, ?, ?)
           ON CONFLICT (taller_id, alumno_id) DO UPDATE SET
             archivo = excluded.archivo, bytes = excluded.bytes, veces = veces + 1, entregada_en = datetime('now')
           RETURNING veces, entregada_en`,
        )
        .get(this.tallerId, alumnoId, archivo, datos.length)!;
      this.entregas.set(alumnoId, { archivo, bytes: datos.length, veces: fila.veces, entregadaEn: isoDe(fila.entregada_en) });
    } catch (err) {
      borrarProyecto(archivo);
      throw err;
    }
    // El archivo viejo se borra recién cuando el nuevo ya quedó en la base.
    borrarProyecto(anterior?.archivo);
    this.ctx.avisar(true);
    return { ok: true };
  }

  /** Para descargar: el archivo de la entrega de un alumno y su nombre. */
  archivoDe(alumnoId: number): { ruta: string; nombre: string } | null {
    const e = this.entregas.get(alumnoId);
    const a = db.prepare<[number], { nombre: string }>('SELECT nombre FROM alumnos WHERE id = ?').get(alumnoId);
    if (!e || !a || !existsSync(rutaProyecto(e.archivo))) return null;
    return { ruta: rutaProyecto(e.archivo), nombre: `${a.nombre} - ${this.titulo}.sb3` };
  }

  accionProfe(accion: AccionScratch): Ack {
    switch (accion?.tipo) {
      case 'mostrar': {
        const id = Number(accion.alumnoId);
        if (!this.entregas.has(id)) return { ok: false, error: 'Ese alumno todavía no entregó.' };
        this.mostrando = id;
        break;
      }
      case 'ocultar':
        this.mostrando = null;
        break;
      default:
        return { ok: false, error: 'Acción desconocida.' };
    }
    this.ctx.avisar(true);
    return { ok: true };
  }

  enviarAlumno(): Ack {
    return { ok: false, error: 'Las entregas se hacen con el botón "Entregar".' };
  }

  alConectar(): void {
    this.ctx.avisar();
  }

  alDesconectar(): void {
    this.ctx.avisar();
  }

  /** El taller sigue hasta que el profe lo cierra: no hay resultados que mostrar. */
  terminada(): boolean {
    return false;
  }

  destruir(): void {}

  private alumnos(): Alumno[] {
    return db
      .prepare<[number], Alumno>('SELECT id, nombre, avatar FROM alumnos WHERE comision_id = ? ORDER BY nombre COLLATE NOCASE')
      .all(this.ctx.comisionId);
  }

  vista(rol: RolSocket, alumnoId?: number): VistaScratch {
    const alumnos = this.alumnos();
    const conectados = new Set(this.ctx.conectados().map((a) => a.id));
    const entregas: EntregaScratch[] =
      rol === 'alumno'
        ? []
        : alumnos.map((a) => {
            const e = this.entregas.get(a.id);
            return {
              alumnoId: a.id,
              nombre: a.nombre,
              avatar: a.avatar,
              conectado: conectados.has(a.id),
              entregadaEn: e?.entregadaEn ?? null,
              bytes: e?.bytes ?? 0,
              veces: e?.veces ?? 0,
            };
          });
    const mostrado = this.mostrando !== null ? this.entregas.get(this.mostrando) : undefined;
    const autor = mostrado ? alumnos.find((a) => a.id === this.mostrando) : undefined;
    const vista: VistaScratch = {
      tallerId: this.tallerId,
      titulo: this.titulo,
      inicialUrl: this.inicial ? urlProyecto(this.inicial.archivo) : null,
      inicialNombre: this.inicial?.nombre ?? null,
      entregaron: alumnos.filter((a) => this.entregas.has(a.id)).length,
      total: alumnos.length,
      entregas,
      mostrando:
        mostrado && autor
          ? { alumnoId: autor.id, nombre: autor.nombre, avatar: autor.avatar, url: urlProyecto(mostrado.archivo), entregadaEn: mostrado.entregadaEn }
          : null,
    };
    if (rol === 'alumno' && alumnoId !== undefined) {
      const mia = this.entregas.get(alumnoId);
      vista.miEntrega = mia ? { url: urlProyecto(mia.archivo), entregadaEn: mia.entregadaEn, veces: mia.veces } : null;
    }
    return vista;
  }
}

function crear(ctx: ContextoActividad, o: OpcionesScratch): TallerScratch | { error: string } {
  const titulo = (typeof o?.titulo === 'string' ? o.titulo.replace(/\s+/g, ' ').trim() : '').slice(0, LIMITES_SCRATCH.titulo) || 'Taller de Scratch';
  let inicial: { nombre: string; archivo: string } | null = null;
  if (o?.inicialId !== null && o?.inicialId !== undefined) {
    const fila = db
      .prepare<[number], { nombre: string; archivo: string }>('SELECT nombre, archivo FROM scratch_iniciales WHERE id = ?')
      .get(Number(o.inicialId));
    if (!fila || !existsSync(rutaProyecto(fila.archivo))) return { error: 'Ese proyecto ya no está. Volvé a cargar la lista.' };
    // Copia propia del taller: si el profe borra el inicial de la lista, el taller sigue andando.
    const archivo = nombreNuevo('t');
    copyFileSync(rutaProyecto(fila.archivo), rutaProyecto(archivo));
    inicial = { nombre: fila.nombre, archivo };
  }
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO scratch_talleres (comision_id, comision_nombre, titulo, inicial_nombre, inicial_archivo) VALUES (?, ?, ?, ?, ?)')
      .run(ctx.comisionId, ctx.comisionNombre, titulo, inicial?.nombre ?? null, inicial?.archivo ?? null);
    return new TallerScratch(ctx, Number(lastInsertRowid), titulo, inicial);
  } catch (err) {
    borrarProyecto(inicial?.archivo);
    console.error('No se pudo crear el taller:', err);
    return { error: 'No se pudo preparar el taller. Probá de nuevo.' };
  }
}

function restaurar(ctx: ContextoActividad, datos: unknown): TallerScratch | null {
  const g = datos as TallerGuardado;
  const fila = db
    .prepare<[number], { titulo: string; comision_id: number | null; inicial_nombre: string | null; inicial_archivo: string | null }>(
      'SELECT titulo, comision_id, inicial_nombre, inicial_archivo FROM scratch_talleres WHERE id = ?',
    )
    .get(Number(g?.tallerId));
  if (!fila || fila.comision_id !== ctx.comisionId) return null;
  const inicial = fila.inicial_archivo && fila.inicial_nombre ? { nombre: fila.inicial_nombre, archivo: fila.inicial_archivo } : null;
  const mostrando = g.mostrando === null || g.mostrando === undefined ? null : Number(g.mostrando);
  return new TallerScratch(ctx, Number(g.tallerId), fila.titulo, inicial, mostrando);
}

export type { TallerScratch };

export const scratch: ModuloActividad<'scratch'> = { crear, restaurar };

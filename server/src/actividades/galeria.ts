import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import {
  CARITAS_ESCALA,
  esImagen,
  LIMITES_GALERIA,
  promedioCaritas,
  type Ack,
  type AccionGaleria,
  type AutorGaleria,
  type MostrarAutor,
  type OpcionesGaleria,
  type PuestoGaleria,
  type RolSocket,
  type VistaGaleria,
  type VotoGaleria,
} from '@aula/shared';
import { db } from '../db';
import { buscarItem, rutaArchivo } from '../db/drive';
import { UPLOADS_DIR } from '../paths';
import type { ContextoActividad, InstanciaActividad, ModuloActividad } from './tipos';

interface Imagen {
  id: number;
  alumnoId: number | null;
  nombre: string;
  archivo: string;
  autor: AutorGaleria | null;
  /** alumnoId → carita (0 a 4). */
  votos: Map<number, number>;
}

const MODOS_AUTOR: readonly MostrarAutor[] = ['nunca', 'revelar', 'final'];
const urlDe = (archivo: string) => `/uploads/${encodeURIComponent(archivo)}`;

function mezclar<T>(lista: T[]): T[] {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j]!, l[i]!];
  }
  return l;
}

/** Crea la galería: copia las imágenes elegidas a uploads/ (en orden al azar) y las guarda en la base. */
function armar(ctx: ContextoActividad, o: OpcionesGaleria): { id: number; titulo: string; mostrarAutor: MostrarAutor; imagenes: Imagen[] } | { error: string } {
  const titulo = (typeof o?.titulo === 'string' ? o.titulo.replace(/\s+/g, ' ').trim() : '').slice(0, LIMITES_GALERIA.titulo) || 'Votación de dibujos';
  const mostrarAutor = MODOS_AUTOR.includes(o?.mostrarAutor) ? o.mostrarAutor : 'final';
  const ids = Array.isArray(o?.itemIds) ? [...new Set(o.itemIds.map(Number))] : [];
  if (ids.length === 0) return { error: 'Elegí al menos un dibujo.' };
  if (ids.length > LIMITES_GALERIA.imagenes) return { error: `Pueden ser hasta ${LIMITES_GALERIA.imagenes} dibujos.` };

  const alumno = db.prepare<[number], { nombre: string; avatar: string; comision_id: number }>('SELECT nombre, avatar, comision_id FROM alumnos WHERE id = ?');
  const elegidas = ids.map((id) => buscarItem(id));
  const validas = elegidas.filter(
    (f) =>
      f && f.tipo === 'archivo' && f.archivo && esImagen(f.mime) && f.en_papelera_desde === null && alumno.get(f.alumno_id)?.comision_id === ctx.comisionId,
  );
  if (validas.length !== ids.length) return { error: 'Alguno de los dibujos ya no está en el Drive. Volvé a cargar la lista.' };

  // Si falta algún archivo en el disco, mejor avisar antes de armar nada.
  if (validas.some((f) => !existsSync(rutaArchivo(f!.alumno_id, f!.archivo!)))) return { error: 'Alguno de los dibujos ya no está. Volvé a cargar la lista.' };

  const copiados: string[] = [];
  try {
    return db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO galerias (comision_id, comision_nombre, titulo, mostrar_autor) VALUES (?, ?, ?, ?)')
        .run(ctx.comisionId, ctx.comisionNombre, titulo, mostrarAutor);
      const galeriaId = Number(lastInsertRowid);
      const ins = db.prepare('INSERT INTO galeria_imagenes (galeria_id, alumno_id, nombre, archivo, orden) VALUES (?, ?, ?, ?, ?)');
      const imagenes: Imagen[] = mezclar(validas).map((f, orden) => {
        const ext = path.extname(f!.archivo!) || '.png';
        const archivo = `g${galeriaId}-${randomBytes(5).toString('hex')}${ext}`;
        copyFileSync(rutaArchivo(f!.alumno_id, f!.archivo!), path.join(UPLOADS_DIR, archivo));
        copiados.push(archivo);
        const a = alumno.get(f!.alumno_id);
        const r = ins.run(galeriaId, f!.alumno_id, f!.nombre, archivo, orden);
        return {
          id: Number(r.lastInsertRowid),
          alumnoId: f!.alumno_id,
          nombre: f!.nombre,
          archivo,
          autor: a ? { nombre: a.nombre, avatar: a.avatar } : null,
          votos: new Map<number, number>(),
        };
      });
      return { id: galeriaId, titulo, mostrarAutor, imagenes };
    })();
  } catch (err) {
    // No queda una galería a medias: la base se deshace sola (transacción) y se borran las copias.
    for (const a of copiados) {
      try {
        unlinkSync(path.join(UPLOADS_DIR, a));
      } catch {
        // ya no estaba
      }
    }
    console.error('No se pudo armar la votación:', err);
    return { error: 'No se pudieron preparar los dibujos. Probá de nuevo.' };
  }
}

interface GaleriaGuardada {
  galeriaId: number;
  indice: number;
  fase: VistaGaleria['fase'];
}

/** Después de un reinicio: la galería y los votos salen de la base; el dibujo y la fase, de lo guardado. */
function restaurarGaleria(ctx: ContextoActividad, datos: unknown): Galeria | null {
  const g = datos as GaleriaGuardada;
  const fila = db
    .prepare<[number], { titulo: string; mostrar_autor: string; comision_id: number | null }>(
      'SELECT titulo, mostrar_autor, comision_id FROM galerias WHERE id = ?',
    )
    .get(Number(g?.galeriaId));
  if (!fila || fila.comision_id !== ctx.comisionId) return null;
  const filas = db
    .prepare<[number], { id: number; alumno_id: number | null; nombre: string; archivo: string; autor: string | null; avatar: string | null }>(
      `SELECT i.id, i.alumno_id, i.nombre, i.archivo, a.nombre AS autor, a.avatar
       FROM galeria_imagenes i LEFT JOIN alumnos a ON a.id = i.alumno_id
       WHERE i.galeria_id = ? ORDER BY i.orden`,
    )
    .all(g.galeriaId);
  if (filas.length === 0) return null;
  const votos = db.prepare<[number], { alumno_id: number; valor: number }>('SELECT alumno_id, valor FROM galeria_votos WHERE imagen_id = ?');
  const imagenes: Imagen[] = filas.map((f) => ({
    id: f.id,
    alumnoId: f.alumno_id,
    nombre: f.nombre,
    archivo: f.archivo,
    autor: f.autor ? { nombre: f.autor, avatar: f.avatar ?? '🙂' } : null,
    votos: new Map(votos.all(f.id).map((v) => [v.alumno_id, v.valor - 1])),
  }));
  const modo = MODOS_AUTOR.includes(fila.mostrar_autor as MostrarAutor) ? (fila.mostrar_autor as MostrarAutor) : 'final';
  const fase = (['votando', 'revelada', 'podio'] as const).includes(g.fase) ? g.fase : 'votando';
  const indice = Math.min(Math.max(0, Math.floor(Number(g.indice)) || 0), imagenes.length - 1);
  return new Galeria(ctx, g.galeriaId, fila.titulo, modo, imagenes, indice, fase);
}

class Galeria implements InstanciaActividad<'galeria'> {
  readonly tipo = 'galeria';
  private readonly guardarVoto = db.prepare('INSERT OR REPLACE INTO galeria_votos (imagen_id, alumno_id, valor) VALUES (?, ?, ?)');

  constructor(
    private readonly ctx: ContextoActividad,
    private readonly galeriaId: number,
    private readonly titulo: string,
    private readonly mostrarAutor: MostrarAutor,
    private readonly imagenes: Imagen[],
    private indice = 0,
    private fase: VistaGaleria['fase'] = 'votando',
  ) {}

  guardar(): GaleriaGuardada {
    return { galeriaId: this.galeriaId, indice: this.indice, fase: this.fase };
  }

  private get actual(): Imagen | undefined {
    return this.imagenes[this.indice];
  }

  accionProfe(accion: AccionGaleria): Ack {
    switch (accion?.tipo) {
      case 'revelar':
        if (this.fase !== 'votando') return { ok: false, error: 'Ya se mostraron los votos de este dibujo.' };
        this.fase = 'revelada';
        break;
      case 'siguiente':
        if (this.fase === 'podio') return { ok: false, error: 'Ya terminó la votación.' };
        if (this.indice >= this.imagenes.length - 1) this.fase = 'podio';
        else {
          this.indice++;
          this.fase = 'votando';
        }
        break;
      case 'podio':
        this.fase = 'podio';
        break;
      default:
        return { ok: false, error: 'Acción desconocida.' };
    }
    this.ctx.avisar(true);
    return { ok: true };
  }

  enviarAlumno(alumnoId: number, envio: VotoGaleria): Ack {
    const img = this.actual;
    if (this.fase !== 'votando' || !img) return { ok: false, error: 'La votación de este dibujo ya cerró.' };
    if (Number(envio?.imagenId) !== img.id) return { ok: false, error: 'Ese dibujo ya pasó.' };
    if (img.alumnoId === alumnoId) return { ok: false, error: 'No podés votar tu propio dibujo.' };
    const valor = Number(envio?.valor);
    if (!Number.isInteger(valor) || valor < 0 || valor >= CARITAS_ESCALA.length) return { ok: false, error: 'Voto inválido.' };
    img.votos.set(alumnoId, valor);
    this.guardarVoto.run(img.id, alumnoId, valor + 1);
    this.ctx.avisar();
    return { ok: true };
  }

  alConectar(): void {
    this.ctx.avisar();
  }

  alDesconectar(): void {
    this.ctx.avisar();
  }

  terminada(): boolean {
    return this.fase === 'podio';
  }

  destruir(): void {}

  private resultados(img: Imagen): number[] {
    const r = CARITAS_ESCALA.map(() => 0);
    for (const v of img.votos.values()) r[v]!++;
    return r;
  }

  private autorVisible(rol: RolSocket): boolean {
    if (rol === 'profe') return true;
    if (this.mostrarAutor === 'nunca') return false;
    if (this.fase === 'podio') return true;
    return this.mostrarAutor === 'revelar' && this.fase === 'revelada';
  }

  private podio(rol: RolSocket): PuestoGaleria[] {
    return this.imagenes
      .map((img) => ({ img, r: this.resultados(img) }))
      .map(({ img, r }) => ({ img, promedio: promedioCaritas(r), votos: img.votos.size }))
      .filter((x): x is { img: Imagen; promedio: number; votos: number } => x.promedio !== null)
      .sort((a, b) => b.promedio - a.promedio || b.votos - a.votos)
      .slice(0, 3)
      .map((x, i) => ({
        puesto: i + 1,
        imagenId: x.img.id,
        url: urlDe(x.img.archivo),
        nombre: x.img.nombre,
        autor: this.autorVisible(rol) ? x.img.autor : null,
        promedio: Math.round(x.promedio * 10) / 10,
        votos: x.votos,
      }));
  }

  vista(rol: RolSocket, alumnoId?: number): VistaGaleria {
    const img = this.actual;
    const resultados = img ? this.resultados(img) : null;
    const mostrarVotos = rol === 'profe' || this.fase === 'revelada';
    const conectados = this.ctx.conectados();
    const promedio = resultados ? promedioCaritas(resultados) : null;
    const vista: VistaGaleria = {
      galeriaId: this.galeriaId,
      titulo: this.titulo,
      fase: this.fase,
      mostrarAutor: this.mostrarAutor,
      indice: this.indice,
      total: this.imagenes.length,
      imagen: img ? { id: img.id, url: urlDe(img.archivo), nombre: img.nombre, autor: this.autorVisible(rol) ? img.autor : null } : null,
      votaron: img?.votos.size ?? 0,
      pueden: conectados.filter((a) => a.id !== img?.alumnoId).length,
      resultados: mostrarVotos ? resultados : null,
      promedio: mostrarVotos && promedio !== null ? Math.round(promedio * 10) / 10 : null,
      podio: this.fase === 'podio' ? this.podio(rol) : [],
    };
    if (rol === 'alumno' && alumnoId !== undefined && img) {
      vista.miVoto = img.votos.get(alumnoId) ?? null;
      vista.esMio = img.alumnoId === alumnoId;
    }
    return vista;
  }
}

export const galeria: ModuloActividad<'galeria'> = {
  crear(ctx, opciones) {
    const g = armar(ctx, opciones);
    if ('error' in g) return g;
    return new Galeria(ctx, g.id, g.titulo, g.mostrarAutor, g.imagenes);
  },
  restaurar: restaurarGaleria,
};

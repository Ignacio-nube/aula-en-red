import type { Presentacion } from '@aula/shared';
import { db } from './index';

interface Fila {
  id: number;
  titulo: string;
  archivo: string;
  paginas: number;
  creado_en: string;
}

const aPresentacion = (f: Fila): Presentacion => ({
  id: f.id,
  titulo: f.titulo,
  archivo: f.archivo,
  paginas: f.paginas,
  creadoEn: f.creado_en,
});

export function listarPresentaciones(): Presentacion[] {
  return db.prepare<[], Fila>('SELECT * FROM presentaciones ORDER BY creado_en DESC, id DESC').all().map(aPresentacion);
}

export function buscarPresentacion(id: number): Presentacion | null {
  const fila = db.prepare<[number], Fila>('SELECT * FROM presentaciones WHERE id = ?').get(id);
  return fila ? aPresentacion(fila) : null;
}

export function crearPresentacion(titulo: string, archivo: string, paginas: number): Presentacion {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO presentaciones (titulo, archivo, paginas) VALUES (?, ?, ?)')
    .run(titulo, archivo, paginas);
  return buscarPresentacion(Number(lastInsertRowid))!;
}

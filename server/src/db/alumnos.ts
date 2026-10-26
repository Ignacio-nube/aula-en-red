import type { AlumnoPublico, Comision } from '@aula/shared';
import { db } from './index';

export interface FilaAlumno {
  id: number;
  comision_id: number;
  nombre: string;
  avatar: string;
  password_hash: string | null;
  creado_en: string;
}

export function aAlumnoPublico(f: FilaAlumno): AlumnoPublico {
  return {
    id: f.id,
    comisionId: f.comision_id,
    nombre: f.nombre,
    avatar: f.avatar,
    tienePassword: f.password_hash !== null,
  };
}

export function listarComisiones(): Comision[] {
  return db
    .prepare<[], Comision>(
      `SELECT c.id, c.nombre, COUNT(a.id) AS cantidadAlumnos
       FROM comisiones c LEFT JOIN alumnos a ON a.comision_id = c.id
       GROUP BY c.id ORDER BY c.nombre COLLATE NOCASE`,
    )
    .all();
}

export function existeComision(id: number): boolean {
  return !!db.prepare('SELECT 1 FROM comisiones WHERE id = ?').get(id);
}

export function listarAlumnos(comisionId: number): AlumnoPublico[] {
  return db
    .prepare<[number], FilaAlumno>('SELECT * FROM alumnos WHERE comision_id = ? ORDER BY nombre COLLATE NOCASE')
    .all(comisionId)
    .map(aAlumnoPublico);
}

export function buscarAlumno(id: number): FilaAlumno | undefined {
  return db.prepare<[number], FilaAlumno>('SELECT * FROM alumnos WHERE id = ?').get(id);
}

export function nombreRepetido(comisionId: number, nombre: string, exceptoId = 0): boolean {
  return !!db
    .prepare('SELECT 1 FROM alumnos WHERE comision_id = ? AND nombre = ? COLLATE NOCASE AND id <> ?')
    .get(comisionId, nombre, exceptoId);
}

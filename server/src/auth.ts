import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { DURACION_SESION_ALUMNO_MS, type AlumnoPublico } from '@aula/shared';
import { db } from './db';
import { aAlumnoPublico, type FilaAlumno } from './db/alumnos';

export function nuevoToken(rol: 'profe' | 'alumno', alumnoId: number | null = null): string {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO tokens (token, rol, alumno_id) VALUES (?, ?, ?)').run(token, rol, alumnoId);
  return token;
}

export function borrarToken(token: string): void {
  db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
}

export function borrarTokensDeAlumno(alumnoId: number): void {
  db.prepare('DELETE FROM tokens WHERE alumno_id = ?').run(alumnoId);
}

export function esTokenProfe(token: string | undefined): boolean {
  if (!token) return false;
  return !!db.prepare("SELECT 1 FROM tokens WHERE token = ? AND rol = 'profe'").get(token);
}

const MODIFICADOR_SESION = `-${Math.round(DURACION_SESION_ALUMNO_MS / 1000)} seconds`;

/** El alumno de ese token, si la sesión sigue abierta (dura DURACION_SESION_ALUMNO_MS desde que ingresó). */
export function alumnoDeToken(token: string | undefined): AlumnoPublico | null {
  if (!token) return null;
  const fila = db
    .prepare<[string, string], FilaAlumno>(
      `SELECT a.* FROM tokens t JOIN alumnos a ON a.id = t.alumno_id
       WHERE t.token = ? AND t.rol = 'alumno' AND a.password_hash IS NOT NULL
         AND t.creado_en > datetime('now', ?)`,
    )
    .get(token, MODIFICADOR_SESION);
  return fila ? aAlumnoPublico(fila) : null;
}

/** Cuánto le queda a la sesión de un alumno (0 si ya venció o no existe). */
export function msRestantesSesion(token: string): number {
  const fila = db
    .prepare<[string], { pasaron: number }>(
      "SELECT (julianday('now') - julianday(creado_en)) * 86400000 AS pasaron FROM tokens WHERE token = ? AND rol = 'alumno'",
    )
    .get(token);
  return fila ? Math.max(0, DURACION_SESION_ALUMNO_MS - fila.pasaron) : 0;
}

/** Borra las sesiones de alumno vencidas (al arrancar y de vez en cuando). */
export function borrarSesionesVencidas(): void {
  db.prepare("DELETE FROM tokens WHERE rol = 'alumno' AND creado_en <= datetime('now', ?)").run(MODIFICADOR_SESION);
}

export function tokenDe(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

export function requireProfe(req: Request, res: Response, next: NextFunction): void {
  if (esTokenProfe(tokenDe(req))) return next();
  res.status(401).json({ error: 'Ingresá el PIN del profe para seguir.' });
}

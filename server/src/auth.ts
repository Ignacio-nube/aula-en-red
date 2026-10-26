import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AlumnoPublico } from '@aula/shared';
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

export function alumnoDeToken(token: string | undefined): AlumnoPublico | null {
  if (!token) return null;
  const fila = db
    .prepare<[string], FilaAlumno>(
      `SELECT a.* FROM tokens t JOIN alumnos a ON a.id = t.alumno_id
       WHERE t.token = ? AND t.rol = 'alumno' AND a.password_hash IS NOT NULL`,
    )
    .get(token);
  return fila ? aAlumnoPublico(fila) : null;
}

export function tokenDe(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

export function requireProfe(req: Request, res: Response, next: NextFunction): void {
  if (esTokenProfe(tokenDe(req))) return next();
  res.status(401).json({ error: 'Ingresá el PIN del profe para seguir.' });
}

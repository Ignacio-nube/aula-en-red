import express, { Router } from 'express';
import { LIMITES_SCRATCH, type ProyectoInicial } from '@aula/shared';
import { actividadDe } from '../actividades/control';
import { borrarProyecto, esSb3, guardarProyecto, isoDe, NOMBRE_PROYECTO, rutaProyecto, type TallerScratch } from '../actividades/scratch';
import { alumnoDeToken, esTokenProfe, requireProfe, tokenDe } from '../auth';
import { db } from '../db';
import { error, idDe } from './util';

export const scratch = Router();

// Los .sb3 viajan crudos (application/octet-stream), como los archivos del Drive.
const crudo = express.raw({ type: () => true, limit: LIMITES_SCRATCH.proyectoBytes + 1024 });

function cuerpo(body: unknown): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.alloc(0);
}

// --- proyectos iniciales (profe) -------------------------------------------------------------

function iniciales(): ProyectoInicial[] {
  return db
    .prepare<[], { id: number; nombre: string; bytes: number; subido_en: string }>(
      'SELECT id, nombre, bytes, subido_en FROM scratch_iniciales ORDER BY subido_en DESC, id DESC',
    )
    .all()
    .map((f) => ({ id: f.id, nombre: f.nombre, bytes: f.bytes, subidoEn: isoDe(f.subido_en) }));
}

scratch.get('/scratch/iniciales', requireProfe, (_req, res) => {
  res.json(iniciales());
});

scratch.post('/scratch/iniciales', requireProfe, crudo, (req, res) => {
  let nombre: string;
  try {
    nombre = decodeURIComponent(String(req.headers['x-nombre'] ?? ''));
  } catch {
    return error(res, 400, 'El archivo no tiene un nombre válido.');
  }
  nombre = nombre.replace(/\.sb3$/i, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Proyecto';
  const datos = cuerpo(req.body);
  if (!esSb3(datos)) return error(res, 400, 'Ese archivo no es un proyecto de Scratch (.sb3).');
  const archivo = guardarProyecto('i', datos);
  db.prepare('INSERT INTO scratch_iniciales (nombre, archivo, bytes) VALUES (?, ?, ?)').run(nombre, archivo, datos.length);
  res.status(201).json(iniciales());
});

scratch.delete('/scratch/iniciales/:id', requireProfe, (req, res) => {
  const fila = db.prepare<[number], { archivo: string }>('SELECT archivo FROM scratch_iniciales WHERE id = ?').get(idDe(req.params.id) ?? 0);
  if (!fila) return error(res, 404, 'Ese proyecto ya no está.');
  db.prepare('DELETE FROM scratch_iniciales WHERE id = ?').run(idDe(req.params.id));
  borrarProyecto(fila.archivo);
  res.json(iniciales());
});

// --- entregas ---------------------------------------------------------------------------------

scratch.post(
  '/scratch/entregas',
  (req, res, next) => (alumnoDeToken(tokenDe(req)) ? next() : error(res, 401, 'Tu sesión se cerró. Volvé a ingresar.')),
  crudo,
  (req, res) => {
    const a = alumnoDeToken(tokenDe(req))!;
    const taller = actividadDe('scratch', a.comisionId) as TallerScratch | null;
    if (!taller) return error(res, 409, 'El taller ya terminó: no se puede entregar.');
    const datos = cuerpo(req.body);
    if (!esSb3(datos)) return error(res, 400, 'No se pudo leer el proyecto. Probá de nuevo.');
    const r = taller.entregar(a.id, datos);
    if (!r.ok) return error(res, 409, r.error);
    res.status(201).json(r);
  },
);

/** Descarga de una entrega del taller en curso (el token del profe va en la URL porque la pide un link). */
scratch.get('/scratch/entregas/:alumnoId/descargar', (req, res) => {
  if (!esTokenProfe(typeof req.query.t === 'string' ? req.query.t : undefined)) return error(res, 401, 'Ingresá el PIN del profe para seguir.');
  const taller = actividadDe('scratch') as TallerScratch | null;
  const f = taller?.archivoDe(idDe(req.params.alumnoId) ?? 0);
  if (!f) return error(res, 404, 'Esa entrega no existe.');
  res.download(f.ruta, f.nombre, (err) => {
    if (err && !res.headersSent) error(res, 404, 'Esa entrega ya no está.');
  });
});

/** El proyecto en sí, para el editor y el reproductor. El nombre es al azar (sirve de llave). */
scratch.get('/scratch/proyectos/:archivo', (req, res) => {
  const archivo = req.params.archivo;
  if (!NOMBRE_PROYECTO.test(archivo)) return error(res, 404, 'Ese proyecto no existe.');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Cada versión tiene su propio nombre: no cambia nunca.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.type('application/x.scratch.sb3');
  res.sendFile(rutaProyecto(archivo), (err) => {
    if (err && !res.headersSent) error(res, 404, 'Ese proyecto ya no está.');
  });
});

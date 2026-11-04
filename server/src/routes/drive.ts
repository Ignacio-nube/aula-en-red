import express, { Router, type Request, type Response } from 'express';
import { esImagen, LIMITES_DRIVE, MIMES_VISTA_PREVIA, type AlumnoPublico, type ImagenDisponible, type ResumenDriveAlumno } from '@aula/shared';
import { actividadDriveCambio } from '../actividades/control';
import { alumnoDeToken, esTokenProfe, requireProfe, tokenDe } from '../auth';
import { db } from '../db';
import {
  aItem,
  aPapelera,
  borrarDefinitivo,
  buscarItem,
  cambiarItem,
  crearCarpeta,
  driveDe,
  filasDe,
  restaurar,
  rutaArchivo,
  subirArchivo,
  vaciarDrive,
  vaciarPapelera,
  type Resultado,
} from '../db/drive';
import { getIo } from '../realtime';
import { error, idDe } from './util';

export const drive = Router();

// --- el Drive del alumno -----------------------------------------------------------------

function alumnoDe(req: Request, res: Response): AlumnoPublico | null {
  const a = alumnoDeToken(tokenDe(req));
  if (!a) error(res, 401, 'Tu sesión se cerró. Volvé a ingresar.');
  return a;
}

/** Contesta con el Drive actualizado y avisa (a las misiones y al profe) que cambió. */
function responder(res: Response, a: AlumnoPublico, r: Resultado, status = 200): void {
  if (!r.ok) return error(res, r.status, r.error);
  actividadDriveCambio(a.id, a.comisionId, r.evento, r.item?.id ?? null);
  if (r.evento) getIo()?.to('profe').emit('drive:cambio', a.id);
  res.status(status).json(driveDe(a.id));
}

drive.get('/drive', (req, res) => {
  const a = alumnoDe(req, res);
  if (a) res.json(driveDe(a.id));
});

drive.post('/drive/carpetas', (req, res) => {
  const a = alumnoDe(req, res);
  if (a) responder(res, a, crearCarpeta(a.id, req.body?.nombre, req.body?.padreId), 201);
});

// El archivo viaja crudo como application/octet-stream (así express.json no se come un .json subido),
// con el nombre y el tipo real en headers.
drive.post(
  '/drive/archivos',
  (req, res, next) => (alumnoDe(req, res) ? next() : undefined),
  express.raw({ type: () => true, limit: LIMITES_DRIVE.archivoBytes + 1024 }),
  (req, res) => {
    const a = alumnoDeToken(tokenDe(req))!;
    let nombre: string;
    try {
      nombre = decodeURIComponent(String(req.headers['x-nombre'] ?? ''));
    } catch {
      return error(res, 400, 'El archivo no tiene un nombre válido.');
    }
    const datos = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const padre = req.query.padre ? Number(req.query.padre) : null;
    responder(res, a, subirArchivo(a.id, nombre, req.headers['x-tipo'], datos, padre), 201);
  },
);

drive.patch('/drive/items/:id', (req, res) => {
  const a = alumnoDe(req, res);
  const id = idDe(req.params.id);
  if (!a) return;
  if (!id) return error(res, 404, 'Ese archivo no existe.');
  const b = req.body ?? {};
  responder(res, a, cambiarItem(a.id, id, { nombre: b.nombre, padreId: b.padreId, destacado: b.destacado, compartido: b.compartido }));
});

drive.post('/drive/items/:id/papelera', (req, res) => {
  const a = alumnoDe(req, res);
  const id = idDe(req.params.id);
  if (!a) return;
  if (!id) return error(res, 404, 'Ese archivo no existe.');
  responder(res, a, aPapelera(a.id, id));
});

drive.post('/drive/items/:id/restaurar', (req, res) => {
  const a = alumnoDe(req, res);
  const id = idDe(req.params.id);
  if (!a) return;
  if (!id) return error(res, 404, 'Ese archivo no existe.');
  responder(res, a, restaurar(a.id, id));
});

drive.delete('/drive/items/:id', (req, res) => {
  const a = alumnoDe(req, res);
  const id = idDe(req.params.id);
  if (!a) return;
  if (!id) return error(res, 404, 'Ese archivo no existe.');
  responder(res, a, borrarDefinitivo(a.id, id));
});

drive.post('/drive/papelera/vaciar', (req, res) => {
  const a = alumnoDe(req, res);
  if (a) responder(res, a, vaciarPapelera(a.id));
});

/**
 * El archivo en sí. Lo ve el dueño o el profe; el token va en la URL porque lo pide un <img> o un link.
 * Solo se muestran dentro del navegador los tipos inofensivos (imágenes, PDF, texto): el resto se descarga,
 * así un .html subido no corre como si fuera parte de la app.
 */
drive.get('/drive/archivo/:id', (req, res) => {
  const token = typeof req.query.t === 'string' ? req.query.t : undefined;
  const f = buscarItem(idDe(req.params.id) ?? 0);
  const alumno = alumnoDeToken(token);
  const permitido = f && f.tipo === 'archivo' && f.archivo && (esTokenProfe(token) || alumno?.id === f.alumno_id);
  if (!f || !permitido || !f.archivo) return error(res, 404, 'Ese archivo no existe.');

  const mostrable = f.mime !== null && (MIMES_VISTA_PREVIA as readonly string[]).includes(f.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (req.query.descargar === '1' || !mostrable) res.attachment(f.nombre);
  res.type(mostrable ? (f.mime === 'text/plain' ? 'text/plain; charset=utf-8' : f.mime!) : 'application/octet-stream');
  res.sendFile(rutaArchivo(f.alumno_id, f.archivo), (err) => {
    if (err && !res.headersSent) error(res, 404, 'Ese archivo ya no está.');
  });
});

// --- el profe ----------------------------------------------------------------------------

drive.get('/profe/drive/comision/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  const alumnos = db
    .prepare<[number], { id: number; nombre: string; avatar: string }>('SELECT id, nombre, avatar FROM alumnos WHERE comision_id = ? ORDER BY nombre')
    .all(id ?? 0);
  const resumen: ResumenDriveAlumno[] = alumnos.map((al) => {
    const filas = filasDe(al.id);
    const vivas = filas.filter((f) => f.en_papelera_desde === null);
    return {
      alumnoId: al.id,
      nombre: al.nombre,
      avatar: al.avatar,
      usados: filas.reduce((a, f) => a + f.tamano, 0),
      archivos: vivas.filter((f) => f.tipo === 'archivo').length,
      carpetas: vivas.filter((f) => f.tipo === 'carpeta').length,
      compartidos: vivas.filter((f) => f.compartido === 1 && f.tipo === 'archivo').map(aItem),
    };
  });
  res.json(resumen);
});

drive.get('/profe/drive/alumno/:id', requireProfe, (req, res) => {
  res.json(driveDe(idDe(req.params.id) ?? 0));
});

function vaciarYAvisar(alumnoIds: number[]): void {
  for (const id of alumnoIds) {
    vaciarDrive(id);
    getIo()
      ?.to(['profe', `alumno:${id}`])
      .emit('drive:cambio', id);
  }
}

drive.delete('/profe/drive/alumno/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  if (id) vaciarYAvisar([id]);
  res.status(204).end();
});

drive.delete('/profe/drive/comision/:id', requireProfe, (req, res) => {
  const ids = db
    .prepare<[number], { id: number }>('SELECT id FROM alumnos WHERE comision_id = ?')
    .all(idDe(req.params.id) ?? 0)
    .map((f) => f.id);
  vaciarYAvisar(ids);
  res.status(204).end();
});

/** Imágenes de los Drives de una comisión, para armar una votación. */
drive.get('/profe/drive/imagenes', requireProfe, (req, res) => {
  const comisionId = idDe(req.query.comision);
  if (!comisionId) return error(res, 400, 'Elegí una comisión.');
  const alumnos = db
    .prepare<[number], { id: number; nombre: string; avatar: string }>('SELECT id, nombre, avatar FROM alumnos WHERE comision_id = ? ORDER BY nombre')
    .all(comisionId);
  const imagenes: ImagenDisponible[] = [];
  for (const al of alumnos) {
    const filas = filasDe(al.id);
    const porId = new Map(filas.map((f) => [f.id, f]));
    for (const f of filas) {
      if (f.tipo !== 'archivo' || f.en_papelera_desde !== null || !esImagen(f.mime)) continue;
      imagenes.push({
        itemId: f.id,
        nombre: f.nombre,
        carpeta: f.padre_id !== null ? (porId.get(f.padre_id)?.nombre ?? null) : null,
        compartido: f.compartido === 1,
        modificadoEn: f.modificado_en,
        alumnoId: al.id,
        alumnoNombre: al.nombre,
        alumnoAvatar: al.avatar,
      });
    }
  }
  res.json(imagenes);
});

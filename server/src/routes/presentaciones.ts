import { randomBytes } from 'node:crypto';
import { createWriteStream, openSync, readSync, closeSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { LIMITE_PDF_MB } from '@aula/shared';
import { requireProfe } from '../auth';
import { alRenombrar, presentacionActual } from '../clase/presentacion';
import { db } from '../db';
import { buscarPresentacion, crearPresentacion, listarPresentaciones } from '../db/presentaciones';
import { PRESENTACIONES_DIR } from '../paths';
import { error, idDe, textoLimpio } from './util';

export const presentaciones = Router();
presentaciones.use('/presentaciones', requireProfe);

presentaciones.get('/presentaciones', (_req, res) => {
  res.json(listarPresentaciones());
});

function empiezaComoPdf(archivo: string): boolean {
  const fd = openSync(archivo, 'r');
  try {
    const cabecera = Buffer.alloc(5);
    readSync(fd, cabecera, 0, 5, 0);
    return cabecera.toString('latin1') === '%PDF-';
  } finally {
    closeSync(fd);
  }
}

/**
 * El navegador manda el PDF crudo (sin multipart) y, en la URL, el título y la cantidad de
 * páginas: las cuenta pdf.js en el navegador del profe, que de paso comprueba que se puede abrir.
 * Se escribe directo a disco para no cargar en memoria un PDF de 100 MB.
 */
presentaciones.post('/presentaciones', async (req, res) => {
  const titulo = textoLimpio(req.query.titulo, 80);
  const paginas = Number(req.query.paginas);
  if (!titulo) return error(res, 400, 'Poné un título para la presentación.');
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > 2000) return error(res, 400, 'No se pudo leer el PDF.');
  if (req.headers['content-type'] !== 'application/pdf') return error(res, 400, 'Subí un archivo PDF.');
  const largo = Number(req.headers['content-length'] ?? 0);
  if (largo > LIMITE_PDF_MB * 1024 * 1024) return error(res, 413, `El PDF pesa más de ${LIMITE_PDF_MB} MB.`);

  const archivo = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.pdf`;
  const destino = path.join(PRESENTACIONES_DIR, archivo);
  let recibidos = 0;
  req.on('data', (parte: Buffer) => {
    recibidos += parte.length;
    if (recibidos > LIMITE_PDF_MB * 1024 * 1024) req.destroy(new Error('demasiado grande'));
  });
  try {
    await pipeline(req, createWriteStream(destino));
  } catch {
    rmSync(destino, { force: true });
    if (!res.headersSent) error(res, recibidos > LIMITE_PDF_MB * 1024 * 1024 ? 413 : 400, 'Se cortó la subida. Probá de nuevo.');
    return;
  }
  if (recibidos === 0 || !empiezaComoPdf(destino)) {
    rmSync(destino, { force: true });
    return error(res, 400, 'Ese archivo no es un PDF.');
  }
  res.status(201).json(crearPresentacion(titulo, archivo, paginas));
});

presentaciones.patch('/presentaciones/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !buscarPresentacion(id)) return error(res, 404, 'Esa presentación no existe.');
  const titulo = textoLimpio(req.body?.titulo, 80);
  if (!titulo) return error(res, 400, 'El título no puede quedar vacío.');
  db.prepare('UPDATE presentaciones SET titulo = ? WHERE id = ?').run(titulo, id);
  alRenombrar(id, titulo);
  res.json(buscarPresentacion(id));
});

presentaciones.delete('/presentaciones/:id', (req, res) => {
  const id = idDe(req.params.id);
  const p = id ? buscarPresentacion(id) : null;
  if (!id || !p) return error(res, 404, 'Esa presentación no existe.');
  if (presentacionActual()?.presentacionId === id) return error(res, 409, 'La estás presentando ahora. Terminala antes de borrarla.');
  db.prepare('DELETE FROM presentaciones WHERE id = ?').run(id);
  rmSync(path.join(PRESENTACIONES_DIR, p.archivo), { force: true });
  res.json({ ok: true });
});

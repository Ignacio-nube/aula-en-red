import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { AVATARES, avatarAlAzar, NIVELES, type ConfigPublica, type NivelPassword } from '@aula/shared';
import { borrarToken, borrarTokensDeAlumno, nuevoToken, requireProfe, tokenDe } from '../auth';
import { PIN_PROFE } from '../config';
import { db, getConfig, setConfig } from '../db';
import { aAlumnoPublico, buscarAlumno, existeComision, listarAlumnos, listarComisiones, nombreRepetido } from '../db/alumnos';
import { actualizarAlumnoEnFila } from '../clase/manos';
import { alBorrar as alBorrarComision } from '../clase/presentacion';
import { alCambiarAlumno, partidaActual } from '../juego/control';
import { emitirPresencia, expulsarAlumno, getIo } from '../realtime';
import { error, idDe, textoLimpio } from './util';

export const profe = Router();

function pinCorrecto(pin: unknown): boolean {
  const a = Buffer.from(String(pin ?? ''));
  const b = Buffer.from(PIN_PROFE);
  return a.length === b.length && timingSafeEqual(a, b);
}

profe.post('/profe/login', (req, res) => {
  if (!pinCorrecto(req.body?.pin)) return error(res, 401, 'PIN incorrecto.');
  res.json({ token: nuevoToken('profe') });
});

profe.get('/profe/yo', requireProfe, (_req, res) => {
  res.json({ ok: true });
});

profe.post('/profe/logout', requireProfe, (req, res) => {
  borrarToken(tokenDe(req)!);
  res.json({ ok: true });
});

// --- config ------------------------------------------------------------------

profe.get('/config', requireProfe, (_req, res) => {
  res.json(getConfig());
});

profe.patch('/config', requireProfe, (req, res) => {
  const cambios: Partial<ConfigPublica> = {};
  if (req.body?.nombreCurso !== undefined) {
    const nombre = textoLimpio(req.body.nombreCurso, 80);
    if (!nombre) return error(res, 400, 'El nombre del curso no puede quedar vacío.');
    cambios.nombreCurso = nombre;
  }
  if (req.body?.nivelMinimoPassword !== undefined) {
    if (!NIVELES.includes(req.body.nivelMinimoPassword)) return error(res, 400, 'Nivel de contraseña inválido.');
    cambios.nivelMinimoPassword = req.body.nivelMinimoPassword as NivelPassword;
  }
  if (req.body?.modoRanking !== undefined) {
    if (req.body.modoRanking !== 'todos' && req.body.modoRanking !== 'top3') return error(res, 400, 'Modo de ranking inválido.');
    cambios.modoRanking = req.body.modoRanking;
  }
  if (req.body?.bonusRacha !== undefined) cambios.bonusRacha = req.body.bonusRacha === true;
  const config = setConfig(cambios);
  getIo()?.emit('config:actualizar', config);
  res.json(config);
});

// --- comisiones --------------------------------------------------------------

profe.post('/comisiones', requireProfe, (req, res) => {
  const nombre = textoLimpio(req.body?.nombre, 40);
  if (!nombre) return error(res, 400, 'Poné un nombre para la comisión.');
  const { lastInsertRowid } = db.prepare('INSERT INTO comisiones (nombre) VALUES (?)').run(nombre);
  res.status(201).json({ id: Number(lastInsertRowid), nombre, cantidadAlumnos: 0 });
});

profe.patch('/comisiones/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  const nombre = textoLimpio(req.body?.nombre, 40);
  if (!id || !existeComision(id)) return error(res, 404, 'Esa comisión no existe.');
  if (!nombre) return error(res, 400, 'Poné un nombre para la comisión.');
  db.prepare('UPDATE comisiones SET nombre = ? WHERE id = ?').run(nombre, id);
  res.json(listarComisiones().find((c) => c.id === id));
});

profe.delete('/comisiones/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !existeComision(id)) return error(res, 404, 'Esa comisión no existe.');
  if (partidaActual()?.comisionId === id && partidaActual()?.fase !== 'podio') {
    return error(res, 409, 'Esta comisión tiene un quiz en curso. Terminalo antes de borrarla.');
  }
  const ids = db.prepare<[number], { id: number }>('SELECT id FROM alumnos WHERE comision_id = ?').all(id);
  alBorrarComision({ comisionId: id });
  db.prepare('DELETE FROM comisiones WHERE id = ?').run(id);
  for (const a of ids) expulsarAlumno(a.id);
  res.json({ ok: true });
});

// --- alumnos -----------------------------------------------------------------

const insertarAlumno = db.prepare('INSERT INTO alumnos (comision_id, nombre, avatar) VALUES (?, ?, ?)');

function avatarValido(valor: unknown): string | null {
  return typeof valor === 'string' && AVATARES.includes(valor) ? valor : null;
}

profe.post('/comisiones/:id/alumnos', requireProfe, (req, res) => {
  const comisionId = idDe(req.params.id);
  if (!comisionId || !existeComision(comisionId)) return error(res, 404, 'Esa comisión no existe.');
  const nombre = textoLimpio(req.body?.nombre);
  if (!nombre) return error(res, 400, 'Escribí el nombre del alumno.');
  if (nombreRepetido(comisionId, nombre)) return error(res, 409, `Ya hay alguien llamado "${nombre}" en esta comisión.`);
  const avatar = avatarValido(req.body?.avatar) ?? avatarAlAzar();
  const { lastInsertRowid } = insertarAlumno.run(comisionId, nombre, avatar);
  res.status(201).json(aAlumnoPublico(buscarAlumno(Number(lastInsertRowid))!));
});

/** Pegar una lista de nombres, uno por línea (también acepta comas o punto y coma). */
profe.post('/comisiones/:id/alumnos/lote', requireProfe, (req, res) => {
  const comisionId = idDe(req.params.id);
  if (!comisionId || !existeComision(comisionId)) return error(res, 404, 'Esa comisión no existe.');
  if (typeof req.body?.texto !== 'string') return error(res, 400, 'Pegá la lista de nombres.');

  const nombres = (req.body.texto as string)
    .split(/[\n;,]+/)
    .map((n) => n.replace(/^\s*(\d+[.)-]|[-*•])\s*/, '')) // "1. Juan", "- Ana"
    .map((n) => textoLimpio(n))
    .filter((n): n is string => n !== null);

  const agregados: string[] = [];
  const repetidos: string[] = [];
  db.transaction(() => {
    for (const nombre of nombres) {
      if (nombreRepetido(comisionId, nombre)) repetidos.push(nombre);
      else {
        insertarAlumno.run(comisionId, nombre, avatarAlAzar());
        agregados.push(nombre);
      }
    }
  })();
  res.json({ agregados, repetidos, alumnos: listarAlumnos(comisionId) });
});

profe.patch('/alumnos/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  const fila = id ? buscarAlumno(id) : undefined;
  if (!id || !fila) return error(res, 404, 'Ese alumno no existe.');

  let nombre = fila.nombre;
  if (req.body?.nombre !== undefined) {
    const nuevo = textoLimpio(req.body.nombre);
    if (!nuevo) return error(res, 400, 'El nombre no puede quedar vacío.');
    if (nombreRepetido(fila.comision_id, nuevo, id)) return error(res, 409, `Ya hay alguien llamado "${nuevo}" en esta comisión.`);
    nombre = nuevo;
  }
  let avatar = fila.avatar;
  if (req.body?.avatar !== undefined) {
    const nuevo = avatarValido(req.body.avatar);
    if (!nuevo) return error(res, 400, 'Ese avatar no está en la lista.');
    avatar = nuevo;
  }
  db.prepare('UPDATE alumnos SET nombre = ?, avatar = ? WHERE id = ?').run(nombre, avatar, id);
  emitirPresencia();
  alCambiarAlumno(id, { id, comisionId: fila.comision_id, nombre, avatar });
  actualizarAlumnoEnFila({ id, comisionId: fila.comision_id, nombre, avatar });
  res.json(aAlumnoPublico(buscarAlumno(id)!));
});

profe.delete('/alumnos/:id', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !buscarAlumno(id)) return error(res, 404, 'Ese alumno no existe.');
  db.prepare('DELETE FROM alumnos WHERE id = ?').run(id);
  alCambiarAlumno(id, null);
  expulsarAlumno(id);
  res.json({ ok: true });
});

/** Borra el hash: el alumno crea una contraseña nueva en su próximo ingreso. */
profe.post('/alumnos/:id/restaurar', requireProfe, (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !buscarAlumno(id)) return error(res, 404, 'Ese alumno no existe.');
  db.prepare('UPDATE alumnos SET password_hash = NULL WHERE id = ?').run(id);
  borrarTokensDeAlumno(id);
  expulsarAlumno(id);
  res.json(aAlumnoPublico(buscarAlumno(id)!));
});

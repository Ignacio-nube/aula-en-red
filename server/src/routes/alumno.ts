import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { alcanzaNivel, evaluarPassword, NOMBRE_NIVEL, type SesionAlumno } from '@aula/shared';
import { alumnoDeToken, borrarToken, nuevoToken, tokenDe } from '../auth';
import { bajarMano } from '../clase/manos';
import { alSalirAlumno } from '../clase/participacion';
import { db, getConfig } from '../db';
import { aAlumnoPublico, buscarAlumno, existeComision, listarAlumnos, listarComisiones } from '../db/alumnos';
import { error, idDe } from './util';

export const alumno = Router();

// --- públicas: lo que necesita la pantalla de ingreso ------------------------

alumno.get('/comisiones', (_req, res) => {
  res.json(listarComisiones());
});

alumno.get('/comisiones/:id/alumnos', (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !existeComision(id)) return error(res, 404, 'Esa comisión no existe.');
  res.json(listarAlumnos(id));
});

// --- sesión del alumno -------------------------------------------------------

const MAX_PASSWORD = 128;

alumno.post('/alumno/crear-password', async (req, res) => {
  const id = idDe(req.body?.alumnoId);
  const password = req.body?.password;
  const fila = id ? buscarAlumno(id) : undefined;
  if (!id || !fila) return error(res, 404, 'No te encontramos en la lista. Avisale al profe.');
  if (fila.password_hash !== null) return error(res, 409, 'Ya tenés contraseña. Ingresala para entrar.');
  if (typeof password !== 'string' || password.length > MAX_PASSWORD) return error(res, 400, 'Escribí una contraseña.');

  // El medidor corre en el navegador, pero el servidor vuelve a chequear.
  const { nivelMinimoPassword } = getConfig();
  const { nivel } = evaluarPassword(password, fila.nombre);
  if (!alcanzaNivel(nivel, nivelMinimoPassword)) {
    return error(res, 400, `Tu contraseña tiene que ser al menos "${NOMBRE_NIVEL[nivelMinimoPassword]}".`);
  }

  const hash = await bcrypt.hash(password, 10);
  // Si dos pestañas la crean a la vez, gana la primera.
  const { changes } = db.prepare('UPDATE alumnos SET password_hash = ? WHERE id = ? AND password_hash IS NULL').run(hash, id);
  if (changes === 0) return error(res, 409, 'Ya tenés contraseña. Ingresala para entrar.');

  const sesion: SesionAlumno = { token: nuevoToken('alumno', id), alumno: aAlumnoPublico(buscarAlumno(id)!) };
  res.status(201).json(sesion);
});

alumno.post('/alumno/login', async (req, res) => {
  const id = idDe(req.body?.alumnoId);
  const password = req.body?.password;
  const fila = id ? buscarAlumno(id) : undefined;
  if (!id || !fila) return error(res, 404, 'No te encontramos en la lista. Avisale al profe.');
  if (fila.password_hash === null) return error(res, 409, 'Todavía no tenés contraseña. Creá una nueva.');
  if (typeof password !== 'string' || password.length > MAX_PASSWORD) return error(res, 400, 'Escribí tu contraseña.');

  if (!(await bcrypt.compare(password, fila.password_hash))) {
    return error(res, 401, 'Esa no es. Probá de nuevo o pedile al profe que la restaure.');
  }
  const sesion: SesionAlumno = { token: nuevoToken('alumno', id), alumno: aAlumnoPublico(fila) };
  res.json(sesion);
});

alumno.get('/alumno/yo', (req, res) => {
  const a = alumnoDeToken(tokenDe(req));
  if (!a) return error(res, 401, 'Tu sesión terminó. Volvé a ingresar.');
  res.json(a);
});

alumno.post('/alumno/logout', (req, res) => {
  const token = tokenDe(req);
  // Si se va, su mano deja de tener sentido.
  const a = alumnoDeToken(token);
  if (a) {
    bajarMano(a.id);
    alSalirAlumno(a.id);
  }
  if (token) borrarToken(token);
  res.json({ ok: true });
});

import { AVATARES, type AlumnoPublico } from '@aula/shared';
import { actualizarAlumnoEnFila } from './clase/manos';
import { db } from './db';
import { aAlumnoPublico, buscarAlumno, nombreRepetido } from './db/alumnos';
import { alCambiarAlumno } from './juego/control';
import { emitirPresencia, getIo } from './realtime';
import { textoLimpio } from './routes/util';

export const MAX_NOMBRE = 60;

export type ResultadoEdicion = { ok: true; alumno: AlumnoPublico } | { ok: false; status: number; error: string };

/**
 * Cambia el nombre o el avatar de un alumno y avisa a todos (presencia, quiz en curso, fila de manos y
 * la compu del alumno). El nombre lo cambia solo el profe; el alumno, solo su emoji.
 */
export function editarAlumno(id: number, cambios: { nombre?: unknown; avatar?: unknown }, quien: 'profe' | 'alumno'): ResultadoEdicion {
  const fila = buscarAlumno(id);
  if (!fila) return { ok: false, status: 404, error: 'Ese alumno no existe.' };

  let nombre = fila.nombre;
  if (cambios.nombre !== undefined && quien === 'profe') {
    const nuevo = textoLimpio(cambios.nombre, MAX_NOMBRE);
    if (!nuevo) return { ok: false, status: 400, error: 'El nombre no puede quedar vacío.' };
    if (nombreRepetido(fila.comision_id, nuevo, id)) return { ok: false, status: 409, error: `Ya hay alguien llamado "${nuevo}" en esta comisión.` };
    nombre = nuevo;
  }
  let avatar = fila.avatar;
  if (cambios.avatar !== undefined) {
    if (typeof cambios.avatar !== 'string' || !AVATARES.includes(cambios.avatar)) return { ok: false, status: 400, error: 'Ese avatar no está en la lista.' };
    avatar = cambios.avatar;
  }

  db.prepare('UPDATE alumnos SET nombre = ?, avatar = ? WHERE id = ?').run(nombre, avatar, id);
  const datos = { id, comisionId: fila.comision_id, nombre, avatar };
  emitirPresencia();
  alCambiarAlumno(id, datos);
  actualizarAlumnoEnFila(datos);
  const alumno = aAlumnoPublico(buscarAlumno(id)!);
  // Todas sus pestañas abiertas se enteran (también si lo cambió el profe).
  getIo()?.to(`alumno:${id}`).emit('alumno:bienvenida', alumno);
  return { ok: true, alumno };
}

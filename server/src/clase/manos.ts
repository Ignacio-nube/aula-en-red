import type { AlumnoConectado, ManoLevantada, MiMano } from '@aula/shared';
import { estaConectado, getIo } from '../realtime';

/**
 * Fila de manos levantadas, en orden de llegada (un Map conserva el orden de inserción).
 * Vive en memoria: si se reinicia el servidor, la fila arranca vacía.
 * Una mano sigue levantada aunque el alumno recargue la página o se le corte el WiFi.
 */
const manos = new Map<number, Omit<ManoLevantada, 'conectado'>>();

export function filaDeManos(): ManoLevantada[] {
  return [...manos.values()].map((m) => ({ ...m, conectado: estaConectado(m.alumnoId) }));
}

export function miMano(alumnoId: number): MiMano {
  const ids = [...manos.keys()];
  const i = ids.indexOf(alumnoId);
  return i === -1 ? { arriba: false, puesto: null } : { arriba: true, puesto: i + 1 };
}

/**
 * Avisa al profe y a los alumnos cuyo puesto pudo cambiar. `tambien` son alumnos que bajaron
 * la mano: ya no están en la fila, pero tienen que enterarse.
 */
export function emitirManos(tambien: number[] = []): void {
  const io = getIo();
  if (!io) return;
  io.to('profe').emit('manos:actualizar', filaDeManos());
  for (const id of new Set([...manos.keys(), ...tambien])) io.to(`alumno:${id}`).emit('mano:estado', miMano(id));
}

export function levantarMano(a: AlumnoConectado): void {
  if (manos.has(a.id)) return;
  manos.set(a.id, { alumnoId: a.id, comisionId: a.comisionId, nombre: a.nombre, avatar: a.avatar, desde: Date.now() });
  emitirManos();
}

export function bajarMano(alumnoId: number): void {
  if (!manos.delete(alumnoId)) return;
  emitirManos([alumnoId]);
}

export function bajarTodas(): void {
  const ids = [...manos.keys()];
  manos.clear();
  emitirManos(ids);
}

/** El profe cambió el nombre o el avatar del alumno. */
export function actualizarAlumnoEnFila(a: AlumnoConectado): void {
  const m = manos.get(a.id);
  if (!m) return;
  manos.set(a.id, { ...m, nombre: a.nombre, avatar: a.avatar });
  emitirManos();
}

import type { Ack, AccionPresentacion, EstadoPresentacion, RolSocket } from '@aula/shared';
import { db, guardarEstado, leerEstado } from '../db';
import { buscarPresentacion } from '../db/presentaciones';
import { cerrarPartidaTerminada, hayJuegoEnCurso } from '../juego/control';
import { getIo } from '../realtime';

/** Una sola presentación en vivo a la vez. Se guarda en la base para retomarla si se reinicia el servidor. */
let enVivo: EstadoPresentacion | null = restaurar();

function restaurar(): EstadoPresentacion | null {
  const guardada = leerEstado<EstadoPresentacion>('presentacion');
  if (!guardada) return null;
  const p = buscarPresentacion(guardada.presentacionId);
  const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(guardada.comisionId);
  if (!p || !comision) {
    guardarEstado('presentacion', null);
    return null;
  }
  return { ...guardada, titulo: p.titulo, comisionNombre: comision.nombre, pagina: Math.min(guardada.pagina, p.paginas) };
}

export function presentacionActual(): EstadoPresentacion | null {
  return enVivo;
}

export function presentacionPara(rol: RolSocket, comisionId?: number): EstadoPresentacion | null {
  if (!enVivo) return null;
  if (rol === 'alumno' && enVivo.comisionId !== comisionId) return null;
  return enVivo;
}

function emitir(anterior: number | null): void {
  guardarEstado('presentacion', enVivo);
  const io = getIo();
  if (!io) return;
  const salas = ['profe', 'pantalla'];
  if (anterior !== null) salas.push(`comision:${anterior}`);
  if (enVivo && enVivo.comisionId !== anterior) salas.push(`comision:${enVivo.comisionId}`);
  io.to(salas).emit('presentacion:estado', enVivo);
}

export function controlarPresentacion(accion: AccionPresentacion): Ack {
  const anterior = enVivo?.comisionId ?? null;

  if (accion.tipo === 'iniciar') {
    if (hayJuegoEnCurso()) return { ok: false, error: 'Hay un quiz en curso. Terminalo antes de presentar.' };
    const p = buscarPresentacion(accion.presentacionId);
    if (!p) return { ok: false, error: 'Esa presentación no existe.' };
    const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(accion.comisionId);
    if (!comision) return { ok: false, error: 'Esa comisión no existe.' };
    cerrarPartidaTerminada();
    enVivo = {
      presentacionId: p.id,
      titulo: p.titulo,
      archivo: p.archivo,
      paginas: p.paginas,
      comisionId: accion.comisionId,
      comisionNombre: comision.nombre,
      pagina: 1,
      libre: false,
    };
    emitir(anterior);
    return { ok: true };
  }

  if (!enVivo) return { ok: false, error: 'No hay ninguna presentación en curso.' };
  switch (accion.tipo) {
    case 'ir': {
      const pagina = Math.round(Number(accion.pagina));
      if (!Number.isFinite(pagina)) return { ok: false, error: 'Diapositiva inválida.' };
      const nueva = Math.min(Math.max(pagina, 1), enVivo.paginas);
      if (nueva === enVivo.pagina) return { ok: true };
      enVivo = { ...enVivo, pagina: nueva };
      break;
    }
    case 'libre':
      enVivo = { ...enVivo, libre: accion.activo === true };
      break;
    case 'terminar':
      enVivo = null;
      break;
  }
  emitir(anterior);
  return { ok: true };
}

/** Se borró la presentación o la comisión: si estaba en vivo, se termina. */
export function alBorrar({ presentacionId, comisionId }: { presentacionId?: number; comisionId?: number }): void {
  if (!enVivo) return;
  if (enVivo.presentacionId === presentacionId || enVivo.comisionId === comisionId) controlarPresentacion({ tipo: 'terminar' });
}

export function alRenombrar(presentacionId: number, titulo: string): void {
  if (enVivo?.presentacionId !== presentacionId) return;
  enVivo = { ...enVivo, titulo };
  emitir(enVivo.comisionId);
}

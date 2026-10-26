import { problemasPregunta, type Ack, type AccionJuego, type AlumnoConectado, type EstadoJuego, type RolSocket, type SesionInterrumpida } from '@aula/shared';
import { db, getConfig, setConfig } from '../db';
import { leerQuiz } from '../db/quizzes';
import { controlarEncuesta } from '../clase/encuesta';
import { presentacionActual } from '../clase/presentacion';
import { getIo, presenciaActual, estaConectado } from '../realtime';
import { Partida } from './partida';

/** Hay un solo juego en vivo a la vez (un solo profe, una sola pantalla). */
let partida: Partida | null = null;

export function partidaActual(): Partida | null {
  return partida;
}

export function estadoPara(rol: RolSocket, alumnoId?: number, comisionId?: number): EstadoJuego | null {
  if (!partida) return null;
  if (rol === 'alumno' && partida.comisionId !== comisionId) return null;
  return partida.vista(rol, alumnoId);
}

// Varios cambios en el mismo tick (responder → cerrar) salen en un solo envío.
let emisionPendiente = false;
export function emitirEstado(): void {
  if (emisionPendiente) return;
  emisionPendiente = true;
  queueMicrotask(() => {
    emisionPendiente = false;
    const io = getIo();
    if (!io) return;
    if (!partida) {
      io.emit('juego:estado', null);
      return;
    }
    io.to('profe').emit('juego:estado', partida.vista('profe'));
    io.to('pantalla').emit('juego:estado', partida.vista('pantalla'));
    // Cada alumno recibe su propia vista (su respuesta, sus puntos, su puesto).
    for (const id of io.sockets.adapter.rooms.get(`comision:${partida.comisionId}`) ?? []) {
      const s = io.sockets.sockets.get(id);
      if (s?.data.alumnoId !== undefined) s.emit('juego:estado', partida.vista('alumno', s.data.alumnoId));
    }
  });
}

function nuevaPartida(crear: (opciones: { avisar: () => void; estaConectado: (id: number) => boolean }) => Partida | null): Partida | null {
  const p = crear({ avisar: emitirEstado, estaConectado });
  if (!p) return null;
  for (const a of presenciaActual()[p.comisionId] ?? []) p.agregarParticipante(a);
  return p;
}

export function hayJuegoEnCurso(): boolean {
  return partida !== null && partida.fase !== 'podio';
}

function cerrarPartida(): void {
  partida?.destruir();
  partida = null;
}

/** Si quedó un podio en pantalla, lo saca (por ejemplo, al empezar una presentación). */
export function cerrarPartidaTerminada(): void {
  if (!partida || hayJuegoEnCurso()) return;
  cerrarPartida();
  emitirEstado();
}

const ERROR_PRESENTANDO = 'Hay una presentación en curso. Terminala antes de empezar un quiz.';

export function controlar(accion: AccionJuego): Ack {
  switch (accion.tipo) {
    case 'iniciar': {
      if (hayJuegoEnCurso()) return { ok: false, error: 'Ya hay un quiz en curso. Terminalo antes de empezar otro.' };
      if (presentacionActual()) return { ok: false, error: ERROR_PRESENTANDO };
      const quiz = leerQuiz(accion.quizId);
      if (!quiz) return { ok: false, error: 'Ese quiz no existe.' };
      if (quiz.preguntas.length === 0) return { ok: false, error: 'El quiz no tiene preguntas.' };
      const incompletas = quiz.preguntas.filter((p) => problemasPregunta(p).length > 0).length;
      if (incompletas > 0) {
        return { ok: false, error: `Hay ${incompletas === 1 ? '1 pregunta' : `${incompletas} preguntas`} sin completar. Revisalas en el editor.` };
      }
      const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(accion.comisionId);
      if (!comision) return { ok: false, error: 'Esa comisión no existe.' };

      cerrarPartida();
      // Si quedaba una encuesta en pantalla, el quiz la reemplaza (lo respondido queda guardado).
      controlarEncuesta({ tipo: 'quitar' });
      const { lastInsertRowid } = db
        .prepare('INSERT INTO sesiones (quiz_id, comision_id, quiz_json, bonus_racha) VALUES (?, ?, ?, ?)')
        .run(quiz.id, accion.comisionId, JSON.stringify(quiz), accion.bonusRacha ? 1 : 0);
      setConfig({ bonusRacha: accion.bonusRacha });
      partida = nuevaPartida(
        (o) => new Partida(Number(lastInsertRowid), accion.comisionId, comision.nombre, quiz, accion.bonusRacha, getConfig().modoRanking, o.avisar, o.estaConectado),
      );
      emitirEstado();
      return { ok: true };
    }

    case 'retomar': {
      if (hayJuegoEnCurso()) return { ok: false, error: 'Ya hay un quiz en curso. Terminalo antes de retomar otro.' };
      if (presentacionActual()) return { ok: false, error: ERROR_PRESENTANDO };
      const p = nuevaPartida((o) => Partida.desdeBase(accion.sesionId, { ...o, modoRanking: getConfig().modoRanking }));
      if (!p) return { ok: false, error: 'No se pudo retomar: esa sesión ya terminó o se borró la comisión.' };
      cerrarPartida();
      partida = p;
      emitirEstado();
      return { ok: true };
    }

    case 'descartar': {
      if (partida?.sesionId === accion.sesionId && hayJuegoEnCurso()) return { ok: false, error: 'Ese quiz está en curso.' };
      db.prepare("UPDATE sesiones SET estado = 'finalizada', finalizada_en = datetime('now') WHERE id = ? AND estado = 'activa'").run(
        accion.sesionId,
      );
      return { ok: true };
    }

    case 'modoRanking':
      setConfig({ modoRanking: accion.modo });
      partida?.cambiarModoRanking(accion.modo);
      return { ok: true };

    case 'cerrar':
      if (hayJuegoEnCurso()) return { ok: false, error: 'Primero terminá el quiz.' };
      cerrarPartida();
      emitirEstado();
      return { ok: true };
  }

  if (!partida) return { ok: false, error: 'No hay ningún quiz en curso.' };
  switch (accion.tipo) {
    case 'siguiente':
      return partida.siguiente();
    case 'pausar':
      return partida.pausar();
    case 'reanudar':
      return partida.reanudar();
    case 'extender':
      return partida.extender();
    case 'saltar':
      return partida.saltar();
    case 'terminar':
      return partida.terminar();
  }
}

export function alConectarAlumno(a: AlumnoConectado): void {
  if (!partida || partida.comisionId !== a.comisionId || partida.fase === 'podio') return;
  partida.agregarParticipante(a);
  emitirEstado();
}

export function alDesconectarAlumno(): void {
  if (!partida) return;
  partida.cerrarSiRespondieronTodos();
  emitirEstado();
}

/** El profe cambió el nombre o el avatar, o borró al alumno. */
export function alCambiarAlumno(alumnoId: number, datos: AlumnoConectado | null): void {
  if (!partida) return;
  if (datos === null) partida.quitarParticipante(alumnoId);
  else if (partida.participantes.has(alumnoId)) partida.agregarParticipante(datos);
  emitirEstado();
}

export function sesionesInterrumpidas(): SesionInterrumpida[] {
  const filas = db
    .prepare<[], { id: number; quiz_json: string; comision: string; iniciada_en: string; ultima_cerrada: number }>(
      `SELECT s.id, s.quiz_json, c.nombre AS comision, s.iniciada_en, s.ultima_cerrada
       FROM sesiones s JOIN comisiones c ON c.id = s.comision_id
       WHERE s.estado = 'activa' ORDER BY s.iniciada_en DESC`,
    )
    .all();
  return filas
    .filter((f) => f.id !== partida?.sesionId)
    .map((f) => {
      const quiz = JSON.parse(f.quiz_json) as { titulo: string; preguntas: unknown[] };
      return {
        id: f.id,
        quizTitulo: quiz.titulo,
        comisionNombre: f.comision,
        iniciadaEn: f.iniciada_en,
        preguntasJugadas: f.ultima_cerrada + 1,
        total: quiz.preguntas.length,
      };
    });
}

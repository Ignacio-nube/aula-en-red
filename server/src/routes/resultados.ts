import { Router } from 'express';
import type {
  FilaRankingFinal,
  HistorialAlumno,
  Quiz,
  ResultadoPregunta,
  SesionDetalle,
  SesionResumen,
} from '@aula/shared';
import { requireProfe } from '../auth';
import { db } from '../db';
import { buscarAlumno } from '../db/alumnos';
import { encuestaActualId, encuestasGuardadas } from '../clase/encuesta';
import { partidaActual, sesionesInterrumpidas } from '../juego/control';
import { error, idDe } from './util';

export const resultados = Router();
resultados.use(['/resultados', '/juego', '/encuestas'], requireProfe);

resultados.get('/encuestas', (_req, res) => {
  res.json(encuestasGuardadas());
});

resultados.delete('/encuestas/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return error(res, 404, 'Esa encuesta no existe.');
  if (encuestaActualId() === id) return error(res, 409, 'Esa encuesta está en pantalla. Terminala primero.');
  db.prepare('DELETE FROM encuestas WHERE id = ?').run(id);
  res.json({ ok: true });
});

interface FilaSesion {
  id: number;
  comision_id: number;
  comision: string;
  quiz_json: string;
  estado: string;
  ultima_cerrada: number;
  iniciada_en: string;
}

const SELECT_SESION = `
  SELECT s.id, s.comision_id, c.nombre AS comision, s.quiz_json, s.estado, s.ultima_cerrada, s.iniciada_en
  FROM sesiones s JOIN comisiones c ON c.id = s.comision_id`;

function rankingSesion(sesionId: number): FilaRankingFinal[] {
  const filas = db
    .prepare<[number, number], { alumnoId: number; nombre: string; avatar: string; puntos: number; aciertos: number }>(
      `SELECT a.id AS alumnoId, a.nombre, a.avatar,
              COALESCE(SUM(r.puntos), 0) AS puntos, COALESCE(SUM(r.correcta), 0) AS aciertos
       FROM sesion_alumnos sa
       JOIN alumnos a ON a.id = sa.alumno_id
       LEFT JOIN respuestas r ON r.sesion_id = ? AND r.alumno_id = a.id
       WHERE sa.sesion_id = ?
       GROUP BY a.id
       ORDER BY puntos DESC, aciertos DESC, a.nombre COLLATE NOCASE`,
    )
    .all(sesionId, sesionId);
  let puesto = 0;
  return filas.map((f, i) => {
    if (i === 0 || filas[i - 1]!.puntos !== f.puntos) puesto = i + 1;
    return { ...f, puesto };
  });
}

function preguntasSesion(s: FilaSesion): ResultadoPregunta[] {
  const quiz = JSON.parse(s.quiz_json) as Quiz;
  const stmt = db.prepare<[number, number], { opcion_id: number | null; correcta: number; respuesta_json: string | null }>(
    'SELECT opcion_id, correcta, respuesta_json FROM respuestas WHERE sesion_id = ? AND pregunta_id = ?',
  );
  return quiz.preguntas.map((p, indice) => {
    const filas = stmt.all(s.id, p.id).map((f) => ({
      ...f,
      eleccion: f.respuesta_json ? (JSON.parse(f.respuesta_json) as number[]) : f.opcion_id !== null ? [f.opcion_id] : [],
    }));
    const estado: ResultadoPregunta['estado'] = filas.length > 0 ? 'jugada' : indice <= s.ultima_cerrada ? 'salteada' : 'no-jugada';
    const correctas = filas.filter((f) => f.correcta === 1).length;
    return {
      id: p.id,
      indice,
      texto: p.texto,
      tipo: p.tipo,
      estado,
      // En "ordenar", cantidad = cuántos pusieron ese paso en su lugar.
      opciones: p.opciones.map((o, i) => ({
        id: o.id,
        texto: o.texto,
        esCorrecta: o.esCorrecta,
        cantidad: filas.filter((f) => (p.tipo === 'ordenar' ? f.eleccion[i] === o.id : f.eleccion.includes(o.id))).length,
      })),
      sinResponder: filas.filter((f) => f.opcion_id === null).length,
      correctas,
      total: filas.length,
      porcentaje: filas.length > 0 ? Math.round((correctas / filas.length) * 100) : null,
    };
  });
}

function resumen(s: FilaSesion, preguntas: ResultadoPregunta[]): SesionResumen {
  const jugadas = preguntas.filter((p) => p.estado === 'jugada');
  const total = jugadas.reduce((n, p) => n + p.total, 0);
  const correctas = jugadas.reduce((n, p) => n + p.correctas, 0);
  const participantes = db.prepare<[number], { n: number }>('SELECT COUNT(*) AS n FROM sesion_alumnos WHERE sesion_id = ?').get(s.id)!.n;
  return {
    id: s.id,
    quizTitulo: (JSON.parse(s.quiz_json) as Quiz).titulo,
    comisionId: s.comision_id,
    comisionNombre: s.comision,
    iniciadaEn: s.iniciada_en,
    finalizada: s.estado === 'finalizada',
    participantes,
    preguntasJugadas: jugadas.length,
    total: preguntas.length,
    porcentajeAciertos: total > 0 ? Math.round((correctas / total) * 100) : null,
  };
}

resultados.get('/resultados/sesiones', (_req, res) => {
  const filas = db.prepare<[], FilaSesion>(`${SELECT_SESION} ORDER BY s.iniciada_en DESC, s.id DESC`).all();
  res.json(filas.map((s) => resumen(s, preguntasSesion(s))));
});

resultados.get('/resultados/sesiones/:id', (req, res) => {
  const id = idDe(req.params.id);
  const s = id ? db.prepare<[number], FilaSesion>(`${SELECT_SESION} WHERE s.id = ?`).get(id) : undefined;
  if (!s) return error(res, 404, 'Esa sesión no existe.');
  const preguntas = preguntasSesion(s);
  const detalle: SesionDetalle = { ...resumen(s, preguntas), ranking: rankingSesion(s.id), preguntas };
  res.json(detalle);
});

resultados.delete('/resultados/sesiones/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id) return error(res, 404, 'Esa sesión no existe.');
  if (partidaActual()?.sesionId === id && partidaActual()?.fase !== 'podio') {
    return error(res, 409, 'Esa sesión está en curso. Terminá el quiz primero.');
  }
  db.prepare('DELETE FROM sesiones WHERE id = ?').run(id);
  res.json({ ok: true });
});

resultados.get('/resultados/alumnos/:id', (req, res) => {
  const id = idDe(req.params.id);
  const alumno = id ? buscarAlumno(id) : undefined;
  if (!id || !alumno) return error(res, 404, 'Ese alumno no existe.');
  const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(alumno.comision_id);
  const filas = db
    .prepare<[number], FilaSesion>(
      `${SELECT_SESION} JOIN sesion_alumnos sa ON sa.sesion_id = s.id WHERE sa.alumno_id = ? ORDER BY s.iniciada_en DESC`,
    )
    .all(id);
  const historial: HistorialAlumno = {
    alumnoId: id,
    nombre: alumno.nombre,
    avatar: alumno.avatar,
    comisionNombre: comision?.nombre ?? '',
    sesiones: filas.map((s) => {
      const ranking = rankingSesion(s.id);
      const yo = ranking.find((r) => r.alumnoId === id);
      return {
        sesionId: s.id,
        quizTitulo: (JSON.parse(s.quiz_json) as Quiz).titulo,
        iniciadaEn: s.iniciada_en,
        puesto: yo?.puesto ?? ranking.length,
        de: ranking.length,
        puntos: yo?.puntos ?? 0,
        aciertos: yo?.aciertos ?? 0,
        preguntasJugadas: preguntasSesion(s).filter((p) => p.estado === 'jugada').length,
      };
    }),
  };
  res.json(historial);
});

resultados.get('/juego/interrumpidas', (_req, res) => {
  res.json(sesionesInterrumpidas());
});

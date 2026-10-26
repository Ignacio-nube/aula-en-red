import { Router, type Response } from 'express';
import { fechaSqlite, type Quiz } from '@aula/shared';
import { requireProfe } from '../auth';
import { encuestasGuardadas } from '../clase/encuesta';
import { db } from '../db';
import { error, idDe } from './util';

export const csv = Router();
csv.use(['/resultados', '/encuestas'], requireProfe);

/**
 * CSV pensado para abrir con doble clic en Excel en castellano: separado por punto y coma (la coma
 * es el separador decimal), con BOM para que reconozca las tildes, y saltos de línea de Windows.
 */
function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    const t = v === null ? '' : String(v);
    return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
}

function enviar(res: Response, nombre: string, filas: (string | number | null)[][]): void {
  const limpio = nombre.replace(/[^\p{L}\p{N} _.-]+/gu, '').trim().slice(0, 80) || 'datos';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(limpio)}.csv`);
  res.send(aCsv(filas));
}

const fecha = (s: string) => fechaSqlite(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });

interface FilaSesion {
  id: number;
  comision: string;
  quiz_json: string;
  iniciada_en: string;
}

/** Una sesión: una fila por alumno, con cómo le fue en cada pregunta. */
csv.get('/resultados/sesiones/:id/csv', (req, res) => {
  const id = idDe(req.params.id);
  const s = id
    ? db
        .prepare<[number], FilaSesion>(
          'SELECT s.id, c.nombre AS comision, s.quiz_json, s.iniciada_en FROM sesiones s JOIN comisiones c ON c.id = s.comision_id WHERE s.id = ?',
        )
        .get(id)
    : undefined;
  if (!s) return error(res, 404, 'Esa sesión no existe.');
  const quiz = JSON.parse(s.quiz_json) as Quiz;
  const alumnos = db
    .prepare<[number, number], { id: number; nombre: string; puntos: number; aciertos: number }>(
      `SELECT a.id, a.nombre, COALESCE(SUM(r.puntos), 0) AS puntos, COALESCE(SUM(r.correcta), 0) AS aciertos
       FROM sesion_alumnos sa JOIN alumnos a ON a.id = sa.alumno_id
       LEFT JOIN respuestas r ON r.sesion_id = ? AND r.alumno_id = a.id
       WHERE sa.sesion_id = ? GROUP BY a.id ORDER BY puntos DESC, aciertos DESC, a.nombre COLLATE NOCASE`,
    )
    .all(s.id, s.id);
  const respuestas = db
    .prepare<[number], { alumno_id: number; pregunta_id: number; opcion_id: number | null; correcta: number; puntos: number }>(
      'SELECT alumno_id, pregunta_id, opcion_id, correcta, puntos FROM respuestas WHERE sesion_id = ?',
    )
    .all(s.id);
  const jugadas = new Set(respuestas.map((r) => r.pregunta_id));

  const filas: (string | number | null)[][] = [
    ['Quiz', quiz.titulo],
    ['Comisión', s.comision],
    ['Fecha', fecha(s.iniciada_en)],
    [],
    ['Puesto', 'Alumno', 'Puntos', 'Aciertos', ...quiz.preguntas.map((p, i) => `${i + 1}. ${p.texto}`)],
  ];
  let puesto = 0;
  alumnos.forEach((a, i) => {
    if (i === 0 || alumnos[i - 1]!.puntos !== a.puntos) puesto = i + 1;
    filas.push([
      puesto,
      a.nombre,
      a.puntos,
      a.aciertos,
      ...quiz.preguntas.map((p) => {
        if (!jugadas.has(p.id)) return 'no se jugó';
        const r = respuestas.find((x) => x.alumno_id === a.id && x.pregunta_id === p.id);
        if (!r || r.opcion_id === null) return 'sin responder';
        return r.correcta ? `bien (+${r.puntos})` : 'mal';
      }),
    ]);
  });
  enviar(res, `${quiz.titulo} - ${s.comision} - ${fechaSqlite(s.iniciada_en).toLocaleDateString('es-AR').replace(/\//g, '-')}`, filas);
});

/** Todas las sesiones juntas: una fila por alumno y sesión (para armar una planilla de notas). */
csv.get('/resultados/csv', (_req, res) => {
  const filas = db
    .prepare<[], { iniciada_en: string; comision: string; quiz_json: string; alumno: string; puntos: number; aciertos: number; respondidas: number }>(
      `SELECT s.iniciada_en, c.nombre AS comision, s.quiz_json, a.nombre AS alumno,
              COALESCE(SUM(r.puntos), 0) AS puntos, COALESCE(SUM(r.correcta), 0) AS aciertos,
              COUNT(r.opcion_id) AS respondidas
       FROM sesiones s
       JOIN comisiones c ON c.id = s.comision_id
       JOIN sesion_alumnos sa ON sa.sesion_id = s.id
       JOIN alumnos a ON a.id = sa.alumno_id
       LEFT JOIN respuestas r ON r.sesion_id = s.id AND r.alumno_id = a.id
       GROUP BY s.id, a.id
       ORDER BY s.iniciada_en DESC, puntos DESC`,
    )
    .all();
  enviar(res, 'Resultados de todos los quizzes', [
    ['Fecha', 'Comisión', 'Quiz', 'Alumno', 'Puntos', 'Aciertos', 'Respondió'],
    ...filas.map((f) => [fecha(f.iniciada_en), f.comision, (JSON.parse(f.quiz_json) as Quiz).titulo, f.alumno, f.puntos, f.aciertos, f.respondidas]),
  ]);
});

csv.get('/encuestas/:id/csv', (req, res) => {
  const id = idDe(req.params.id);
  const e = encuestasGuardadas().find((x) => x.id === id);
  if (!e) return error(res, 404, 'Esa encuesta no existe.');
  const filas: (string | number | null)[][] = [
    ['Encuesta', e.pregunta],
    ['Comisión', e.comisionNombre],
    ['Fecha', fecha(e.creadaEn)],
    ['Respondieron', e.respondieron],
    [],
  ];
  if (e.tipo === 'texto') {
    filas.push(e.anonima ? ['Respuesta'] : ['Alumno', 'Respuesta']);
    for (const t of e.textos) filas.push(e.anonima ? [t.texto] : [t.nombre ?? '', t.texto]);
  } else {
    filas.push(['Opción', 'Votos', 'Porcentaje']);
    e.opciones.forEach((o, i) =>
      filas.push([o, e.resultados[i] ?? 0, e.respondieron > 0 ? `${Math.round(((e.resultados[i] ?? 0) / e.respondieron) * 100)}%` : '0%']),
    );
  }
  enviar(res, `Encuesta - ${e.pregunta.slice(0, 40)}`, filas);
});

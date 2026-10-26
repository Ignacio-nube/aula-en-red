import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { LIMITES } from '@aula/shared';
import { requireProfe } from '../auth';
import { db } from '../db';
import { aEntrada, crearQuiz, guardarQuiz, leerQuiz, listarQuizzes, normalizarEntrada } from '../db/quizzes';
import { UPLOADS_DIR } from '../paths';
import { error, idDe } from './util';

export const quizzes = Router();
quizzes.use('/quizzes', requireProfe);

quizzes.get('/quizzes', (_req, res) => {
  res.json(listarQuizzes());
});

quizzes.post('/quizzes', (req, res) => {
  const entrada = normalizarEntrada({
    titulo: req.body?.titulo,
    descripcion: '',
    // Arranca con una pregunta vacía para que el editor no quede en blanco.
    preguntas: [{ tipo: 'multiple', texto: '', tiempoSeg: 20, multiplicador: 1, opciones: [{}, {}, {}, {}] }],
  });
  res.status(201).json(crearQuiz(entrada));
});

quizzes.get('/quizzes/:id', (req, res) => {
  const id = idDe(req.params.id);
  const quiz = id ? leerQuiz(id) : null;
  if (!quiz) return error(res, 404, 'Ese quiz no existe.');
  res.json(quiz);
});

quizzes.put('/quizzes/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !leerQuiz(id)) return error(res, 404, 'Ese quiz no existe (¿lo borraron desde otra pestaña?).');
  res.json(guardarQuiz(id, normalizarEntrada(req.body)));
});

quizzes.post('/quizzes/:id/duplicar', (req, res) => {
  const id = idDe(req.params.id);
  const quiz = id ? leerQuiz(id) : null;
  if (!quiz) return error(res, 404, 'Ese quiz no existe.');
  const entrada = aEntrada(quiz);
  entrada.titulo = `${quiz.titulo} (copia)`.slice(0, LIMITES.titulo);
  res.status(201).json(crearQuiz(entrada));
});

quizzes.delete('/quizzes/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !leerQuiz(id)) return error(res, 404, 'Ese quiz no existe.');
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- imágenes de preguntas ---------------------------------------------------
// El navegador manda el archivo crudo (ya achicado), con su Content-Type. Sin multipart.

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

quizzes.post(
  '/imagenes',
  requireProfe,
  express.raw({ type: Object.keys(EXTENSION), limit: '6mb' }),
  (req, res) => {
    const ext = EXTENSION[req.headers['content-type'] ?? ''];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return error(res, 400, 'Subí una imagen PNG, JPG, WEBP o GIF.');
    }
    const archivo = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
    writeFileSync(path.join(UPLOADS_DIR, archivo), req.body);
    res.status(201).json({ archivo });
  },
);

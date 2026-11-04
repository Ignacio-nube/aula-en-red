import { Router } from 'express';
import type { CarreraResumen, HistorialTipeo, MarcaTipeo } from '@aula/shared';
import { requireProfe } from '../auth';
import { db } from '../db';
import { borrarTexto, buscarTexto, crearTexto, editarTexto, listarTextos, validarTexto } from '../db/tipeo';
import { enviar, fecha } from './csv';
import { error, idDe } from './util';

export const tipeo = Router();
tipeo.use('/tipeo', requireProfe);

// --- textos para practicar --------------------------------------------------------------

tipeo.get('/tipeo/textos', (_req, res) => {
  res.json(listarTextos());
});

tipeo.post('/tipeo/textos', (req, res) => {
  const t = validarTexto(req.body ?? {});
  if (typeof t === 'string') return error(res, 400, t);
  res.status(201).json(crearTexto(t));
});

tipeo.put('/tipeo/textos/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (!id || !buscarTexto(id)) return error(res, 404, 'Ese texto no existe.');
  const t = validarTexto(req.body ?? {});
  if (typeof t === 'string') return error(res, 400, t);
  res.json(editarTexto(id, t));
});

tipeo.delete('/tipeo/textos/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (id) borrarTexto(id);
  res.status(204).end();
});

// --- historial -------------------------------------------------------------------------

interface FilaResultado {
  carrera_id: number;
  alumno_id: number;
  nombre: string;
  avatar: string;
  comision: string;
  ppm: number;
  precision: number;
  completo: number;
  iniciada_en: string;
  titulo: string;
}

function resultados(): FilaResultado[] {
  return db
    .prepare<[], FilaResultado>(
      `SELECT r.carrera_id, r.alumno_id, a.nombre, a.avatar, COALESCE(c.nombre, k.comision_nombre) AS comision,
              r.ppm, r.precision, r.completo, k.iniciada_en, k.titulo
       FROM tipeo_resultados r
       JOIN tipeo_carreras k ON k.id = r.carrera_id
       JOIN alumnos a ON a.id = r.alumno_id
       LEFT JOIN comisiones c ON c.id = a.comision_id
       WHERE r.avance > 0
       ORDER BY k.iniciada_en, k.id`,
    )
    .all();
}

tipeo.get('/tipeo/historial', (_req, res) => {
  const filas = resultados();
  const carreras = db
    .prepare<[], { id: number; titulo: string; comision_nombre: string; iniciada_en: string }>(
      'SELECT id, titulo, comision_nombre, iniciada_en FROM tipeo_carreras ORDER BY iniciada_en DESC, id DESC',
    )
    .all()
    .map((k): CarreraResumen => {
      const deEsta = filas.filter((f) => f.carrera_id === k.id);
      // Gana el que terminó más rápido; si nadie terminó, el de más ppm.
      const mejor = [...deEsta].sort((a, b) => b.completo - a.completo || b.ppm - a.ppm)[0];
      return {
        id: k.id,
        titulo: k.titulo,
        comisionNombre: k.comision_nombre,
        iniciadaEn: k.iniciada_en,
        participantes: deEsta.length,
        completaron: deEsta.filter((f) => f.completo === 1).length,
        ganador: mejor ? { nombre: mejor.nombre, avatar: mejor.avatar, ppm: Math.round(mejor.ppm) } : null,
      };
    })
    .filter((k) => k.participantes > 0);

  const porAlumno = new Map<number, FilaResultado[]>();
  for (const f of filas) porAlumno.set(f.alumno_id, [...(porAlumno.get(f.alumno_id) ?? []), f]);
  const alumnos = [...porAlumno.values()]
    .map((lista): MarcaTipeo => {
      const primera = lista[0]!;
      const ultima = lista[lista.length - 1]!;
      return {
        alumnoId: ultima.alumno_id,
        nombre: ultima.nombre,
        avatar: ultima.avatar,
        comisionNombre: ultima.comision,
        carreras: lista.length,
        mejorPpm: Math.round(Math.max(...lista.map((f) => f.ppm))),
        primeraPpm: Math.round(primera.ppm),
        ultimaPpm: Math.round(ultima.ppm),
        ultimaPrecision: Math.round(ultima.precision),
        ultimaFecha: ultima.iniciada_en,
      };
    })
    .sort((a, b) => a.comisionNombre.localeCompare(b.comisionNombre, 'es') || b.mejorPpm - a.mejorPpm);

  const historial: HistorialTipeo = { carreras, alumnos };
  res.json(historial);
});

tipeo.delete('/tipeo/carreras/:id', (req, res) => {
  const id = idDe(req.params.id);
  if (id) db.prepare('DELETE FROM tipeo_carreras WHERE id = ?').run(id);
  res.status(204).end();
});

tipeo.get('/tipeo/csv', (_req, res) => {
  enviar(res, 'Carreras de tipeo', [
    ['Fecha', 'Comisión', 'Texto', 'Alumno', 'Palabras por minuto', 'Precisión (%)', 'Terminó'],
    ...resultados()
      .reverse()
      .map((f) => [fecha(f.iniciada_en), f.comision, f.titulo, f.nombre, Math.round(f.ppm), Math.round(f.precision), f.completo ? 'sí' : 'no']),
  ]);
});

import {
  LIMITES,
  maxOpciones,
  opcionesVF,
  TIPOS_PREGUNTA,
  problemasPregunta,
  TIEMPOS_SEG,
  type Multiplicador,
  type Quiz,
  type QuizEntrada,
  type QuizResumen,
  type TipoPregunta,
} from '@aula/shared';
import { db } from './index';

interface FilaQuiz {
  id: number;
  titulo: string;
  descripcion: string;
  actualizado_en: string;
}
interface FilaPregunta {
  id: number;
  tipo: TipoPregunta;
  texto: string;
  imagen: string | null;
  tiempo_seg: number;
  multiplicador: Multiplicador;
}
interface FilaOpcion {
  id: number;
  pregunta_id: number;
  texto: string;
  es_correcta: number;
}

export function leerQuiz(id: number): Quiz | null {
  const q = db.prepare<[number], FilaQuiz>('SELECT * FROM quizzes WHERE id = ?').get(id);
  if (!q) return null;
  const preguntas = db
    .prepare<[number], FilaPregunta>('SELECT * FROM preguntas WHERE quiz_id = ? ORDER BY orden')
    .all(id);
  const opciones = db
    .prepare<[number], FilaOpcion>(
      `SELECT o.* FROM opciones o JOIN preguntas p ON p.id = o.pregunta_id WHERE p.quiz_id = ? ORDER BY o.orden`,
    )
    .all(id);
  return {
    id: q.id,
    titulo: q.titulo,
    descripcion: q.descripcion,
    actualizadoEn: q.actualizado_en,
    preguntas: preguntas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      texto: p.texto,
      imagen: p.imagen,
      tiempoSeg: p.tiempo_seg,
      multiplicador: p.multiplicador,
      opciones: opciones
        .filter((o) => o.pregunta_id === p.id)
        .map((o) => ({ id: o.id, texto: o.texto, esCorrecta: o.es_correcta === 1 })),
    })),
  };
}

export function listarQuizzes(): QuizResumen[] {
  const filas = db.prepare<[], FilaQuiz>('SELECT * FROM quizzes ORDER BY actualizado_en DESC, id DESC').all();
  return filas.map((f) => {
    const quiz = leerQuiz(f.id)!;
    return {
      id: f.id,
      titulo: f.titulo,
      descripcion: f.descripcion,
      cantidadPreguntas: quiz.preguntas.length,
      problemas: quiz.preguntas.filter((p) => problemasPregunta(p).length > 0).length,
      actualizadoEn: f.actualizado_en,
    };
  });
}

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Deja la entrada en una forma que la base acepta. Permite borradores incompletos
 *  (textos vacíos, sin correcta): eso se valida al iniciar el juego. */
export function normalizarEntrada(entrada: unknown): QuizEntrada {
  const e = (entrada ?? {}) as Partial<QuizEntrada>;
  const preguntas = Array.isArray(e.preguntas) ? e.preguntas.slice(0, LIMITES.preguntas) : [];
  return {
    titulo: texto(e.titulo, LIMITES.titulo) || 'Quiz sin título',
    descripcion: texto(e.descripcion, LIMITES.descripcion),
    preguntas: preguntas.map((p) => {
      const tipo: TipoPregunta = TIPOS_PREGUNTA.includes(p?.tipo) ? p.tipo : 'multiple';
      const tiempoSeg = (TIEMPOS_SEG as readonly number[]).includes(p?.tiempoSeg) ? p.tiempoSeg : 20;
      const multiplicador: Multiplicador = p?.multiplicador === 0 || p?.multiplicador === 2 ? p.multiplicador : 1;
      const imagen = typeof p?.imagen === 'string' && /^[\w-]+\.(png|jpe?g|webp|gif)$/i.test(p.imagen) ? p.imagen : null;
      let opciones = (Array.isArray(p?.opciones) ? p.opciones : [])
        .slice(0, maxOpciones(tipo))
        .map((o) => ({ texto: texto(o?.texto, LIMITES.opcion), esCorrecta: o?.esCorrecta === true }));
      if (tipo === 'vf') opciones = opcionesVF(opciones[1]?.esCorrecta !== true);
      // En "ordenar" no hay correctas: vale el orden. Se marcan todas para que nada falle si se cambia el tipo.
      if (tipo === 'ordenar') opciones = opciones.map((o) => ({ ...o, esCorrecta: true }));
      while (opciones.length < LIMITES.minOpciones) opciones.push({ texto: '', esCorrecta: false });
      return { tipo, texto: texto(p?.texto, LIMITES.pregunta), imagen, tiempoSeg, multiplicador, opciones };
    }),
  };
}

const insPregunta = db.prepare(
  'INSERT INTO preguntas (quiz_id, orden, tipo, texto, imagen, tiempo_seg, multiplicador) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const insOpcion = db.prepare('INSERT INTO opciones (pregunta_id, orden, texto, es_correcta) VALUES (?, ?, ?, ?)');

function escribirPreguntas(quizId: number, preguntas: QuizEntrada['preguntas']): void {
  // Las sesiones guardan su propia copia del quiz, así que reemplazar todo no rompe el historial.
  db.prepare('DELETE FROM preguntas WHERE quiz_id = ?').run(quizId);
  preguntas.forEach((p, i) => {
    const { lastInsertRowid } = insPregunta.run(quizId, i, p.tipo, p.texto, p.imagen, p.tiempoSeg, p.multiplicador);
    p.opciones.forEach((o, j) => insOpcion.run(lastInsertRowid, j, o.texto, o.esCorrecta ? 1 : 0));
  });
}

export function crearQuiz(entrada: QuizEntrada): Quiz {
  const id = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO quizzes (titulo, descripcion) VALUES (?, ?)')
      .run(entrada.titulo, entrada.descripcion);
    escribirPreguntas(Number(lastInsertRowid), entrada.preguntas);
    return Number(lastInsertRowid);
  })();
  return leerQuiz(id)!;
}

export function guardarQuiz(id: number, entrada: QuizEntrada): Quiz {
  db.transaction(() => {
    db.prepare("UPDATE quizzes SET titulo = ?, descripcion = ?, actualizado_en = datetime('now') WHERE id = ?").run(
      entrada.titulo,
      entrada.descripcion,
      id,
    );
    escribirPreguntas(id, entrada.preguntas);
  })();
  return leerQuiz(id)!;
}

export function aEntrada(q: Quiz): QuizEntrada {
  return {
    titulo: q.titulo,
    descripcion: q.descripcion,
    preguntas: q.preguntas.map(({ tipo, texto, imagen, tiempoSeg, multiplicador, opciones }) => ({
      tipo,
      texto,
      imagen,
      tiempoSeg,
      multiplicador,
      opciones: opciones.map(({ texto, esCorrecta }) => ({ texto, esCorrecta })),
    })),
  };
}

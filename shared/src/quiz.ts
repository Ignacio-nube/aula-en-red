// Quizzes: modelo, reglas de validación y puntaje. Lo usan el editor, el servidor y el juego.

export const TIEMPOS_SEG = [5, 10, 20, 30, 60, 90, 120] as const;
/** multiple: una correcta. vf: verdadero o falso. varias: hay que marcar todas las correctas.
 *  ordenar: los pasos se muestran mezclados y hay que ponerlos en orden (el orden guardado es el correcto). */
export type TipoPregunta = 'multiple' | 'vf' | 'varias' | 'ordenar';
export const TIPOS_PREGUNTA: readonly TipoPregunta[] = ['multiple', 'vf', 'varias', 'ordenar'];
export const NOMBRE_TIPO: Record<TipoPregunta, string> = {
  multiple: 'Opción múltiple',
  vf: 'Verdadero o falso',
  varias: 'Varias correctas',
  ordenar: 'Ordenar pasos',
};

/** Lo que manda el alumno: una opción, o varias (las que marcó, o el orden que armó). */
export type RespuestaJuego = number | number[];
/** 1 = normal, 2 = doble, 0 = sin puntos. */
export type Multiplicador = 0 | 1 | 2;

export const NOMBRE_MULTIPLICADOR: Record<Multiplicador, string> = { 1: 'Normal', 2: 'Doble', 0: 'Sin puntos' };
export const LETRAS = ['A', 'B', 'C', 'D'] as const;

export const LIMITES = {
  titulo: 80,
  descripcion: 300,
  pregunta: 200,
  opcion: 80,
  preguntas: 100,
  minOpciones: 2,
  maxOpciones: 4,
  minPasos: 3,
  maxPasos: 6,
} as const;

export function maxOpciones(tipo: TipoPregunta): number {
  return tipo === 'ordenar' ? LIMITES.maxPasos : tipo === 'vf' ? 2 : LIMITES.maxOpciones;
}

export interface OpcionQuiz {
  id: number;
  texto: string;
  esCorrecta: boolean;
}

export interface PreguntaQuiz {
  id: number;
  tipo: TipoPregunta;
  texto: string;
  /** Nombre del archivo en /uploads, o null. */
  imagen: string | null;
  tiempoSeg: number;
  multiplicador: Multiplicador;
  opciones: OpcionQuiz[];
}

export interface Quiz {
  id: number;
  titulo: string;
  descripcion: string;
  preguntas: PreguntaQuiz[];
  actualizadoEn: string;
}

export interface QuizResumen {
  id: number;
  titulo: string;
  descripcion: string;
  cantidadPreguntas: number;
  /** Cantidad de preguntas con algo por completar: si es > 0 no se puede jugar. */
  problemas: number;
  actualizadoEn: string;
}

/** Lo que manda el editor al guardar: sin ids (el servidor los asigna). */
export interface QuizEntrada {
  titulo: string;
  descripcion: string;
  preguntas: {
    tipo: TipoPregunta;
    texto: string;
    imagen: string | null;
    tiempoSeg: number;
    multiplicador: Multiplicador;
    opciones: { texto: string; esCorrecta: boolean }[];
  }[];
}

export function opcionesVF(verdaderoEsCorrecta = true): { texto: string; esCorrecta: boolean }[] {
  return [
    { texto: 'Verdadero', esCorrecta: verdaderoEsCorrecta },
    { texto: 'Falso', esCorrecta: !verdaderoEsCorrecta },
  ];
}

type PreguntaParaValidar = Pick<PreguntaQuiz, 'tipo' | 'texto' | 'tiempoSeg'> & { opciones: { texto: string; esCorrecta: boolean }[] };

/** Lo que le falta a una pregunta para poder jugarse. Vacío = lista. */
export function problemasPregunta(p: PreguntaParaValidar): string[] {
  const problemas: string[] = [];
  if (!p.texto.trim()) problemas.push('Falta el texto de la pregunta.');
  if (p.tipo === 'ordenar') {
    if (p.opciones.length < LIMITES.minPasos) problemas.push(`Necesita al menos ${LIMITES.minPasos} pasos.`);
    if (p.opciones.some((o) => !o.texto.trim())) problemas.push('Hay pasos sin texto.');
    if (new Set(p.opciones.map((o) => o.texto.trim().toLowerCase())).size < p.opciones.length) problemas.push('Hay dos pasos iguales.');
  } else {
    if (p.tipo !== 'vf') {
      if (p.opciones.length < LIMITES.minOpciones) problemas.push('Necesita al menos 2 opciones.');
      if (p.opciones.some((o) => !o.texto.trim())) problemas.push('Hay opciones sin texto.');
    }
    const correctas = p.opciones.filter((o) => o.esCorrecta).length;
    if (correctas === 0) problemas.push(p.tipo === 'varias' ? 'Marcá las respuestas correctas.' : 'Marcá cuál es la respuesta correcta.');
    if (correctas > 1 && p.tipo !== 'varias') problemas.push('Solo puede haber una correcta (o cambiá el tipo a "Varias correctas").');
  }
  if (!(TIEMPOS_SEG as readonly number[]).includes(p.tiempoSeg)) problemas.push('Elegí un tiempo de la lista.');
  return problemas;
}

/** Puntos de una respuesta correcta: de 1000 (al instante) a 500 (al límite), por el multiplicador. */
export function puntaje(tiempoMs: number, totalMs: number, multiplicador: Multiplicador): number {
  const fraccion = Math.min(1, Math.max(0, tiempoMs / totalMs));
  return Math.round(1000 * (1 - fraccion / 2)) * multiplicador;
}

/** Bonus por racha: +100 desde la 2.ª correcta seguida, hasta +500. */
export function bonusPorRacha(racha: number): number {
  return racha >= 2 ? Math.min(500, 100 * (racha - 1)) : 0;
}

/** ¿Es correcta esta respuesta? Varias: exactamente las correctas. Ordenar: el orden guardado. */
export function esRespuestaCorrecta(p: Pick<PreguntaQuiz, 'tipo' | 'opciones'>, respuesta: RespuestaJuego): boolean {
  if (p.tipo === 'ordenar') {
    return Array.isArray(respuesta) && respuesta.length === p.opciones.length && p.opciones.every((o, i) => o.id === respuesta[i]);
  }
  if (p.tipo === 'varias') {
    if (!Array.isArray(respuesta)) return false;
    const correctas = p.opciones.filter((o) => o.esCorrecta).map((o) => o.id);
    return respuesta.length === correctas.length && correctas.every((id) => respuesta.includes(id));
  }
  return typeof respuesta === 'number' && p.opciones.some((o) => o.id === respuesta && o.esCorrecta);
}

/**
 * Orden mezclado (siempre distinto del correcto) para las preguntas de ordenar. Depende solo de
 * la semilla: si el servidor se reinicia, cada pregunta vuelve a salir igual.
 */
export function mezclar<T>(items: readonly T[], semilla: number): T[] {
  let x = (semilla * 2654435761) % 4294967296 || 1;
  const azar = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
  const r = [...items];
  for (let intento = 0; intento < 10; intento++) {
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [r[i], r[j]] = [r[j]!, r[i]!];
    }
    if (r.some((v, i) => v !== items[i])) return r;
  }
  return [...items.slice(1), items[0]!];
}

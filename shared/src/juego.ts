// Estado del juego en vivo. El servidor arma una "vista" distinta para profe, pantalla y cada alumno.
import type { Multiplicador, TipoPregunta } from './quiz';
import type { CorredorTipeo } from './tipeo';

export type FaseJuego = 'lobby' | 'cuenta' | 'pregunta' | 'resultado' | 'ranking' | 'podio';
export type ModoRanking = 'todos' | 'top3';

export const SEGUNDOS_CUENTA = 3;
export const EXTENSION_MS = 10_000;

export interface OpcionEnJuego {
  id: number;
  texto: string;
  /** Solo se manda cuando la pregunta ya cerró (o al profe). */
  correcta?: boolean;
}

export interface PreguntaEnJuego {
  id: number;
  tipo: TipoPregunta;
  texto: string;
  imagen: string | null;
  multiplicador: Multiplicador;
  /** En "ordenar" vienen mezcladas (es lo que el alumno tiene que ordenar). */
  opciones: OpcionEnJuego[];
  /** "ordenar": ids en el orden correcto. Solo cuando ya cerró (o al profe). */
  ordenCorrecto?: number[];
}

export interface FilaRanking {
  alumnoId: number;
  nombre: string;
  avatar: string;
  puntos: number;
  /** Puestos con empate: dos con los mismos puntos comparten puesto. */
  puesto: number;
  aciertos: number;
  racha: number;
  /** Puntos que sumó en la última pregunta cerrada. */
  delta: number;
  conectado: boolean;
  /** Índice en EQUIPOS, o null si se juega de a uno. */
  equipo: number | null;
}

/** Un equipo en el ranking: el puntaje es el promedio de sus integrantes. */
export interface FilaEquipo {
  equipo: number;
  puntos: number;
  /** Lo que subió el promedio en la última pregunta cerrada. */
  delta: number;
  puesto: number;
  integrantes: number;
}

export interface MiEstado {
  respondio: boolean;
  /** Lo que eligió en multiple/vf. */
  opcionId: number | null;
  /** Lo que eligió en varias (las que marcó) u ordenar (el orden que armó). */
  opcionIds?: number[];
  /** Desde que cierra la pregunta: cómo le fue. */
  correcta?: boolean;
  puntosPregunta?: number;
  bonus?: number;
  racha: number;
  puntos: number;
  puesto: number | null;
  /** Su equipo (índice en EQUIPOS) y el puesto del equipo, si se juega por equipos. */
  equipo?: number;
  puestoEquipo?: number;
  /** Carrera de tipeo: lo que lleva (para retomar si recarga) y, al cerrar, cómo le fue. */
  tipeo?: { posicion: number; errores: number; ppm: number; precision: number; terminado: boolean; puesto: number | null };
}

export interface EstadoJuego {
  sesionId: number;
  quizTitulo: string;
  comisionId: number;
  comisionNombre: string;
  fase: FaseJuego;
  /** Índice de la pregunta actual (o la última jugada), desde 0. -1 en la sala de espera. */
  indice: number;
  total: number;
  pregunta: PreguntaEnJuego | null;
  /** Tiempo total de la pregunta (con los +10 s sumados) y lo que queda, en ms. Nunca horas absolutas. */
  tiempoTotalMs: number;
  restanteMs: number;
  pausado: boolean;
  respondieron: number;
  /** Participantes conectados ahora. */
  conectados: number;
  /** Respuestas por opción, en el orden de `pregunta.opciones`. Al profe siempre; al resto cuando cierra.
   *  En "ordenar": cuántos pusieron ese paso en su lugar. */
  distribucion: number[] | null;
  /** Cuántos respondieron bien (cuando la distribución se puede ver). */
  correctas: number | null;
  /** Profe: siempre todos. Pantalla: según `modoRanking`. Alumno: solo el top 3 en el podio. */
  ranking: FilaRanking[];
  modoRanking: ModoRanking;
  bonusRacha: boolean;
  /** Solo para el profe: quiénes ya respondieron la pregunta actual. */
  quienesRespondieron?: number[];
  /** Ranking de equipos (null = se juega de a uno). Lo ven todos. */
  equipos: FilaEquipo[] | null;
  /** Carrera de tipeo: los corredores (profe y pantalla; el alumno solo el top 3 al cerrar). null en otras preguntas. */
  carrera: CorredorTipeo[] | null;
  /** Carrera de tipeo: ms desde que arrancó la pregunta, para que cada compu calcule sus ppm. */
  transcurridoMs: number;
  /** Preguntas salteadas (índices). */
  salteadas: number[];
  /** Solo para cada alumno. */
  yo?: MiEstado;
}

export type AccionJuego =
  | { tipo: 'iniciar'; quizId: number; comisionId: number; bonusRacha: boolean; equipos: number | null; /** Carreras de tipeo sin tildes ni mayúsculas. */ facil?: boolean }
  | { tipo: 'retomar'; sesionId: number }
  | { tipo: 'descartar'; sesionId: number }
  | { tipo: 'siguiente' }
  | { tipo: 'pausar' }
  | { tipo: 'reanudar' }
  | { tipo: 'extender' }
  | { tipo: 'saltar' }
  | { tipo: 'terminar' }
  | { tipo: 'cerrar' }
  | { tipo: 'modoRanking'; modo: ModoRanking }
  /**
   * En la sala de espera: rearmar los equipos al azar, emparejarlos moviendo a los menos posibles,
   * cambiar cuántos equipos hay, o pasar a alguien a otro equipo.
   */
  | { tipo: 'mezclarEquipos' }
  | { tipo: 'emparejarEquipos' }
  | { tipo: 'cantidadEquipos'; cantidad: number }
  | { tipo: 'moverEquipo'; alumnoId: number; equipo: number };

export type Ack = { ok: true } | { ok: false; error: string };

/** Sesión que quedó sin terminar (por ejemplo, porque se apagó el servidor). */
export interface SesionInterrumpida {
  id: number;
  quizTitulo: string;
  comisionNombre: string;
  iniciadaEn: string;
  preguntasJugadas: number;
  total: number;
}

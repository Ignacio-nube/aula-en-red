// Historial de sesiones, para la sección Resultados del profe.
import type { FilaEquipo } from './juego';
import type { TipoPregunta } from './quiz';

export interface SesionResumen {
  id: number;
  quizTitulo: string;
  comisionId: number;
  comisionNombre: string;
  /** Fecha en UTC, formato SQLite ("2026-10-23 14:05:00"). */
  iniciadaEn: string;
  finalizada: boolean;
  participantes: number;
  preguntasJugadas: number;
  total: number;
  /** Promedio de aciertos sobre las preguntas jugadas, de 0 a 100. null si no se jugó ninguna. */
  porcentajeAciertos: number | null;
}

export interface FilaRankingFinal {
  alumnoId: number;
  nombre: string;
  avatar: string;
  puesto: number;
  puntos: number;
  aciertos: number;
  /** Índice en EQUIPOS, si se jugó por equipos. */
  equipo: number | null;
}

export interface ResultadoPregunta {
  id: number;
  indice: number;
  texto: string;
  tipo: TipoPregunta;
  estado: 'jugada' | 'salteada' | 'no-jugada';
  opciones: { id: number; texto: string; esCorrecta: boolean; cantidad: number }[];
  sinResponder: number;
  correctas: number;
  total: number;
  porcentaje: number | null;
  /** Carrera de tipeo: "correctas" son los que llegaron al final; acá, la velocidad. */
  tipeo?: { promedioPpm: number; mejor: { nombre: string; ppm: number } | null };
}

export interface SesionDetalle extends SesionResumen {
  ranking: FilaRankingFinal[];
  /** Ranking de equipos (promedio por integrante), o null si se jugó de a uno. */
  equipos: FilaEquipo[] | null;
  preguntas: ResultadoPregunta[];
}

export interface ParticipacionAlumno {
  sesionId: number;
  quizTitulo: string;
  iniciadaEn: string;
  puesto: number;
  de: number;
  puntos: number;
  aciertos: number;
  preguntasJugadas: number;
}

export interface HistorialAlumno {
  alumnoId: number;
  nombre: string;
  avatar: string;
  comisionNombre: string;
  sesiones: ParticipacionAlumno[];
}

/** Las fechas de SQLite vienen en UTC sin zona: convertirlas a Date local. */
export function fechaSqlite(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z');
}

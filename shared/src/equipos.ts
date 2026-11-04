// Equipos del quiz. Cada uno tiene color Y mascota, para distinguirlos sin depender del color.

export interface Equipo {
  nombre: string;
  mascota: string;
  /** Fondo del equipo y el texto que va encima (con contraste AA). */
  color: string;
  texto: string;
}

export const EQUIPOS: readonly Equipo[] = [
  { nombre: 'Celestes', mascota: '🐬', color: '#0b7db0', texto: '#ffffff' },
  { nombre: 'Corales', mascota: '🦩', color: '#c93c39', texto: '#ffffff' },
  { nombre: 'Amarillos', mascota: '🐝', color: '#f5b700', texto: '#3c3c3b' },
  { nombre: 'Verdes', mascota: '🐸', color: '#1a7f4f', texto: '#ffffff' },
  { nombre: 'Violetas', mascota: '🦄', color: '#7048b6', texto: '#ffffff' },
  { nombre: 'Naranjas', mascota: '🦊', color: '#c25a00', texto: '#ffffff' },
];

export const MIN_EQUIPOS = 2;
export const MAX_EQUIPOS = EQUIPOS.length;

export function equipo(i: number): Equipo {
  return EQUIPOS[i] ?? EQUIPOS[0]!;
}

/**
 * Puntaje del equipo: el promedio de sus integrantes (redondeado). Así un equipo con más gente no
 * gana solo por ser más.
 */
export function promedioEquipo(puntos: readonly number[]): number {
  return puntos.length === 0 ? 0 : Math.round(puntos.reduce((a, b) => a + b, 0) / puntos.length);
}

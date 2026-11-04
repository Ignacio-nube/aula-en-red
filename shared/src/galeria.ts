// Galería con votación: el profe muestra los dibujos que subieron al Drive uno por uno
// y la clase vota cada uno con las caritas (CARITAS_ESCALA). Al final, un podio.

export const LIMITES_GALERIA = { titulo: 60, imagenes: 60 } as const;

/** Cuándo se ve quién hizo cada dibujo. */
export type MostrarAutor = 'nunca' | 'revelar' | 'final';

export interface OpcionesGaleria {
  titulo: string;
  /** Archivos de Drive (ids de ItemDrive) que entran, en cualquier orden: se mezclan al empezar. */
  itemIds: number[];
  mostrarAutor: MostrarAutor;
}

export type AccionGaleria =
  /** Muestra cómo votaron el dibujo actual. */
  | { tipo: 'revelar' }
  /** Pasa al dibujo que sigue (o al podio, si era el último). */
  | { tipo: 'siguiente' }
  | { tipo: 'podio' };

/** Lo que manda el alumno: la carita (0 a 4) para el dibujo que se está mostrando. */
export interface VotoGaleria {
  imagenId: number;
  valor: number;
}

export interface AutorGaleria {
  nombre: string;
  avatar: string;
}

export interface PuestoGaleria {
  puesto: number;
  imagenId: number;
  url: string;
  nombre: string;
  autor: AutorGaleria | null;
  promedio: number;
  votos: number;
}

export interface VistaGaleria {
  galeriaId: number;
  titulo: string;
  fase: 'votando' | 'revelada' | 'podio';
  mostrarAutor: MostrarAutor;
  /** Dibujo actual (0 = el primero) y cuántos hay. */
  indice: number;
  total: number;
  imagen: { id: number; url: string; nombre: string; autor: AutorGaleria | null } | null;
  votaron: number;
  /** Alumnos conectados que pueden votar este dibujo (sin contar al autor). */
  pueden: number;
  /** Votos por carita (5 números); solo cuando está revelada. */
  resultados: number[] | null;
  promedio: number | null;
  /** Solo en el podio. */
  podio: PuestoGaleria[];
  /** Alumno: su voto para el dibujo actual (0 a 4) y si el dibujo es suyo. */
  miVoto?: number | null;
  esMio?: boolean;
}

/** Promedio de 1 a 5 a partir de los votos por carita (índices 0 a 4). */
export function promedioCaritas(resultados: number[]): number | null {
  const total = resultados.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return resultados.reduce((acc, n, i) => acc + n * (i + 1), 0) / total;
}

// Carrera de tipeo: todos tipean el mismo texto; en la pantalla se ve la carrera en vivo.

export type FaseTipeo = 'sala' | 'cuenta' | 'carrera' | 'fin';

export const LIMITES_TIPEO = { titulo: 60, texto: 600, minTexto: 20 } as const;
/** Opciones de tiempo límite, en segundos (null = hasta que terminen todos). */
export const LIMITES_TIEMPO_TIPEO = [null, 60, 120, 180] as const;
/** Más rápido que esto (palabras por minuto) no es humano para una clase: se recorta. */
export const PPM_MAXIMO = 250;
/** Una "palabra" son 5 letras (incluidos los espacios), como en cualquier test de tipeo. */
export const LETRAS_POR_PALABRA = 5;

export interface TextoTipeo {
  id: number;
  titulo: string;
  texto: string;
  creadoEn: string;
}

export interface OpcionesTipeo {
  textoId: number;
  /** Sin tildes ni mayúsculas, para los que recién empiezan. */
  facil: boolean;
  limiteSeg: number | null;
}

export type AccionTipeo =
  /** Sala → cuenta regresiva → carrera. */
  | { tipo: 'empezar' }
  /** Corta la carrera: cuenta lo que llegó a tipear cada uno. */
  | { tipo: 'terminar' }
  /** Vuelve a la sala con el mismo texto u otro. */
  | { tipo: 'otraVuelta'; opciones: OpcionesTipeo };

/** Lo que manda el alumno mientras tipea: hasta qué letra llegó y cuántas teclas erró. */
export interface ProgresoTipeo {
  posicion: number;
  errores: number;
}

export interface CorredorTipeo {
  alumnoId: number;
  nombre: string;
  avatar: string;
  /** Letras tipeadas bien, de 0 a texto.length. */
  posicion: number;
  ppm: number;
  /** De 0 a 100. */
  precision: number;
  terminado: boolean;
  /** Cuánto tardó en terminar (ms), si terminó. */
  tiempoMs: number | null;
  /** Puesto actual: primero los que terminaron (por tiempo) y después por avance. */
  puesto: number;
  conectado: boolean;
}

export interface MiTipeo {
  posicion: number;
  errores: number;
  ppm: number;
  precision: number;
  terminado: boolean;
  puesto: number | null;
  /** Su mejor marca antes de esta carrera (ppm), si tiene. */
  mejorAnterior: number | null;
}

export interface VistaTipeo {
  carreraId: number | null;
  /** El texto elegido (para "otra vuelta" con el mismo). */
  textoId: number;
  fase: FaseTipeo;
  titulo: string;
  texto: string;
  facil: boolean;
  limiteSeg: number | null;
  /** Cuenta: ms hasta que arranca. Carrera: ms hasta el límite (null = sin límite). */
  restanteMs: number | null;
  /** Carrera: ms desde que arrancó, para que cada compu calcule su ppm con su reloj. */
  transcurridoMs: number;
  /** Profe y pantalla: todos. Alumno: solo el top 3 al final. */
  corredores: CorredorTipeo[];
  /** Cuántos están en la carrera y cuántos terminaron. */
  participantes: number;
  terminaron: number;
  yo?: MiTipeo;
}

/** Palabras por minuto con `posicion` letras en `ms` milisegundos. */
export function calcularPpm(posicion: number, ms: number): number {
  if (ms < 1000 || posicion <= 0) return 0;
  return Math.min(PPM_MAXIMO, Math.round(posicion / LETRAS_POR_PALABRA / (ms / 60_000)));
}

export function calcularPrecision(posicion: number, errores: number): number {
  return posicion + errores === 0 ? 100 : Math.round((posicion / (posicion + errores)) * 100);
}

/** Lo que se puede tipear con cualquier teclado: comillas y guiones rectos, un solo espacio. */
export function normalizarTexto(texto: string): string {
  return texto
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Modo fácil: minúsculas y sin tildes (la ñ se queda: está en el teclado). */
export function textoFacil(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'ñ')
    .replace(/[¿¡]/g, '');
}

// --- historial (pestaña Resultados) --------------------------------------------------

export interface CarreraResumen {
  id: number;
  titulo: string;
  comisionNombre: string;
  /** UTC, formato SQLite. */
  iniciadaEn: string;
  participantes: number;
  completaron: number;
  ganador: { nombre: string; avatar: string; ppm: number } | null;
}

/** Cómo viene cada alumno: su mejor marca y la última, para ver el progreso semana a semana. */
export interface MarcaTipeo {
  alumnoId: number;
  nombre: string;
  avatar: string;
  comisionNombre: string;
  carreras: number;
  mejorPpm: number;
  primeraPpm: number;
  ultimaPpm: number;
  ultimaPrecision: number;
  ultimaFecha: string;
}

export interface HistorialTipeo {
  carreras: CarreraResumen[];
  alumnos: MarcaTipeo[];
}

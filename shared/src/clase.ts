// Presentaciones sincronizadas y participación (levantar la mano).

export interface Presentacion {
  id: number;
  titulo: string;
  /** Nombre del PDF dentro de `server/data/presentaciones/`. Se sirve en `/presentaciones/<archivo>`. */
  archivo: string;
  paginas: number;
  creadoEn: string;
}

export const LIMITE_PDF_MB = 150;

/** Presentación en vivo. La reciben el profe, la pantalla y los alumnos de esa comisión. */
export interface EstadoPresentacion {
  presentacionId: number;
  titulo: string;
  archivo: string;
  paginas: number;
  comisionId: number;
  comisionNombre: string;
  /** Diapositiva actual, desde 1. */
  pagina: number;
  /** Modo libre: los alumnos pueden moverse por el PDF por su cuenta. */
  libre: boolean;
}

export type AccionPresentacion =
  | { tipo: 'iniciar'; presentacionId: number; comisionId: number }
  | { tipo: 'ir'; pagina: number }
  | { tipo: 'libre'; activo: boolean }
  | { tipo: 'terminar' };

export interface ManoLevantada {
  alumnoId: number;
  comisionId: number;
  nombre: string;
  avatar: string;
  /** Date.now() del servidor cuando la levantó. */
  desde: number;
  conectado: boolean;
}

/** Lo que ve cada alumno de su propia mano. */
export interface MiMano {
  arriba: boolean;
  /** Lugar en la fila, desde 1 (null si no está levantada). */
  puesto: number | null;
}

// --- Fase 4: más participación -------------------------------------------------

/** Señales anónimas del alumno. Se borran solas a los pocos minutos. */
export type TipoSenal = 'noEntendi' | 'despacio';
export const DURACION_SENAL_MS = 3 * 60_000;

export interface ConteoSenales {
  noEntendi: number;
  despacio: number;
}

export type MisSenales = Record<TipoSenal, boolean>;

/** Pregunta anónima: el profe nunca recibe quién la mandó. */
export interface PreguntaAnonima {
  id: number;
  texto: string;
  desde: number;
}
export const LIMITE_PREGUNTA_ANONIMA = 280;

export type AccionPreguntas = { tipo: 'borrar'; id: number } | { tipo: 'destacar'; id: number } | { tipo: 'quitarDestacada' } | { tipo: 'borrarTodas' };

/** "Miren al frente": pantalla completa en las compus de los alumnos. Es convivencia, no un bloqueo. */
export interface Atencion {
  mensaje: string;
  /** null = todos los conectados. */
  comisionId: number | null;
}

export type TipoEncuesta = 'opciones' | 'escala' | 'texto';
export const CARITAS_ESCALA = ['😣', '😕', '😐', '🙂', '🤩'] as const;
export const LIMITE_RESPUESTA_TEXTO = 400;

export interface EncuestaEnVivo {
  id: number;
  comisionId: number;
  comisionNombre: string;
  pregunta: string;
  tipo: TipoEncuesta;
  /** Opciones (tipo "opciones") o las 5 caritas (tipo "escala"). Vacío en "texto". */
  opciones: string[];
  anonima: boolean;
  abierta: boolean;
  respondieron: number;
  conectados: number;
  /** Votos por opción. Al profe siempre; a la pantalla y los alumnos, cuando se cierra. */
  resultados: number[] | null;
  /** Solo al profe, en las de texto. Sin nombre si es anónima. */
  textos?: { texto: string; nombre?: string }[];
  /** Solo a cada alumno: lo que respondió (índice de opción o texto). */
  miRespuesta?: number | string | null;
}

export type AccionEncuesta =
  | { tipo: 'iniciar'; comisionId: number; pregunta: string; tipoEncuesta: TipoEncuesta; opciones: string[]; anonima: boolean }
  | { tipo: 'cerrar' }
  | { tipo: 'quitar' };

export interface EncuestaGuardada {
  id: number;
  comisionNombre: string;
  pregunta: string;
  tipo: TipoEncuesta;
  opciones: string[];
  anonima: boolean;
  creadaEn: string;
  respondieron: number;
  resultados: number[];
  textos: { texto: string; nombre?: string }[];
}

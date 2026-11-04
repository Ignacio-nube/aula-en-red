// Simulador de Drive: cada alumno tiene su unidad (carpetas y archivos) que queda guardada entre clases.
// Sirve para practicar subir, ordenar y compartir archivos sin usar cuentas reales.

export const LIMITES_DRIVE = {
  /** Por archivo. Las imágenes se achican en el navegador antes de subirlas. */
  archivoBytes: 10 * 1024 * 1024,
  /** Lo que puede ocupar cada alumno en total (como el "almacenamiento" de un Drive real). */
  cuotaBytes: 100 * 1024 * 1024,
  nombre: 80,
  /** Carpetas y archivos por alumno, contando la papelera. */
  items: 500,
} as const;

export type TipoItemDrive = 'carpeta' | 'archivo';

export interface ItemDrive {
  id: number;
  /** Carpeta que lo contiene (null = "Mi unidad"). */
  padreId: number | null;
  tipo: TipoItemDrive;
  nombre: string;
  /** Solo en archivos. */
  mime: string | null;
  /** Bytes (0 en carpetas). */
  tamano: number;
  destacado: boolean;
  /** Compartido con el profe. */
  compartido: boolean;
  enPapelera: boolean;
  /** UTC, formato SQLite. */
  creadoEn: string;
  modificadoEn: string;
}

/** Toda la unidad de un alumno: el cliente navega las carpetas sin volver a pedir nada. */
export interface MiDrive {
  items: ItemDrive[];
  /** Bytes usados (incluye la papelera, como en el real). */
  usados: number;
  cuota: number;
}

export interface CambioDrive {
  nombre?: string;
  /** Mover: la carpeta de destino (null = Mi unidad). */
  padreId?: number | null;
  destacado?: boolean;
  compartido?: boolean;
}

/** Lo que pasó en un Drive, para que las misiones se tilden solas. */
export type EventoDrive = 'carpeta' | 'subir' | 'renombrar' | 'mover' | 'destacar' | 'compartir' | 'papelera' | 'restaurar' | 'borrar';

/** Para el profe: cómo viene el Drive de cada alumno de una comisión. */
export interface ResumenDriveAlumno {
  alumnoId: number;
  nombre: string;
  avatar: string;
  usados: number;
  archivos: number;
  carpetas: number;
  /** Lo que compartió con el profe (fuera de la papelera). */
  compartidos: ItemDrive[];
}

/** Una imagen de algún Drive que se puede sumar a una votación. */
export interface ImagenDisponible {
  itemId: number;
  nombre: string;
  /** Carpeta en la que está (null = suelta en Mi unidad). */
  carpeta: string | null;
  compartido: boolean;
  modificadoEn: string;
  alumnoId: number;
  alumnoNombre: string;
  alumnoAvatar: string;
}

/** Tipos que el navegador puede mostrar sin peligro dentro de la app. */
export const MIMES_VISTA_PREVIA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'] as const;
export const MIMES_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export function esImagen(mime: string | null): boolean {
  return mime !== null && (MIMES_IMAGEN as readonly string[]).includes(mime);
}

/** Nombre sin extensión, en minúsculas y sin tildes ni espacios de más: para comparar lo que pide una misión. */
export function nombreComparable(nombre: string, sacarExtension = false): string {
  let n = nombre.trim();
  if (sacarExtension) n = n.replace(/\.[a-z0-9]{1,5}$/i, '');
  return n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** "1,2 MB", "340 KB". */
export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString('es-AR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

// --- misiones (actividad "drive") ------------------------------------------------------

export type PasoMision =
  /** Crear una carpeta con ese nombre. */
  | { tipo: 'carpeta'; nombre: string }
  /** Subir un archivo (o una imagen), opcionalmente dentro de una carpeta. */
  | { tipo: 'subir'; carpeta: string | null; soloImagen: boolean }
  /** Cambiarle el nombre a un archivo o carpeta para que se llame así. */
  | { tipo: 'renombrar'; nombre: string }
  /** Mover algo a esa carpeta. */
  | { tipo: 'mover'; carpeta: string }
  | { tipo: 'destacar' }
  /** Compartir un archivo con el profe, opcionalmente uno que esté en esa carpeta. */
  | { tipo: 'compartir'; carpeta: string | null }
  | { tipo: 'papelera' }
  | { tipo: 'restaurar' };

export type TipoPasoMision = PasoMision['tipo'];

export const LIMITES_MISION = { titulo: 60, pasos: 10, nombre: 40 } as const;

export interface OpcionesMisiones {
  titulo: string;
  pasos: PasoMision[];
}

export const PLANTILLAS_MISIONES: (OpcionesMisiones & { descripcion: string })[] = [
  {
    titulo: 'Entregar un dibujo',
    descripcion: 'Lo justo para después votar los dibujos.',
    pasos: [
      { tipo: 'carpeta', nombre: 'Arte' },
      { tipo: 'subir', carpeta: 'Arte', soloImagen: true },
      { tipo: 'compartir', carpeta: 'Arte' },
    ],
  },
  {
    titulo: 'Primeros pasos en Drive',
    descripcion: 'Carpetas, subir, renombrar, destacar y compartir.',
    pasos: [
      { tipo: 'carpeta', nombre: 'Escuela' },
      { tipo: 'subir', carpeta: null, soloImagen: false },
      { tipo: 'mover', carpeta: 'Escuela' },
      { tipo: 'renombrar', nombre: 'Mi primer archivo' },
      { tipo: 'destacar' },
      { tipo: 'compartir', carpeta: null },
    ],
  },
  {
    titulo: 'La papelera',
    descripcion: 'Borrar algo sin perderlo y recuperarlo.',
    pasos: [{ tipo: 'subir', carpeta: null, soloImagen: false }, { tipo: 'papelera' }, { tipo: 'restaurar' }],
  },
];

/** Cómo se lee cada paso en la lista de misiones. */
export function textoPaso(p: PasoMision): string {
  switch (p.tipo) {
    case 'carpeta':
      return `Creá una carpeta llamada "${p.nombre}"`;
    case 'subir': {
      const que = p.soloImagen ? 'una imagen' : 'un archivo';
      return p.carpeta ? `Subí ${que} a la carpeta "${p.carpeta}"` : `Subí ${que} a tu Drive`;
    }
    case 'renombrar':
      return `Cambiale el nombre a un archivo para que se llame "${p.nombre}"`;
    case 'mover':
      return `Mové un archivo a la carpeta "${p.carpeta}"`;
    case 'destacar':
      return 'Destacá un archivo con la estrellita';
    case 'compartir':
      return p.carpeta ? `Compartí con el profe un archivo de la carpeta "${p.carpeta}"` : 'Compartí un archivo con el profe';
    case 'papelera':
      return 'Mandá un archivo a la papelera';
    case 'restaurar':
      return 'Recuperá un archivo de la papelera';
  }
}

export const NOMBRE_TIPO_PASO: Record<TipoPasoMision, string> = {
  carpeta: 'Crear carpeta',
  subir: 'Subir archivo',
  renombrar: 'Cambiar nombre',
  mover: 'Mover a carpeta',
  destacar: 'Destacar',
  compartir: 'Compartir con el profe',
  papelera: 'Mandar a la papelera',
  restaurar: 'Recuperar de la papelera',
};

export type AccionMisiones = { tipo: 'terminar' } | { tipo: 'reabrir' };

export interface FilaMision {
  alumnoId: number;
  nombre: string;
  avatar: string;
  hechos: boolean[];
  /** Puesto en que completó todo (1 = el primero), si ya completó. */
  puesto: number | null;
  conectado: boolean;
}

export interface VistaMisiones {
  titulo: string;
  pasos: string[];
  fase: 'curso' | 'fin';
  /** Profe y pantalla: todos. Alumno: vacío. */
  alumnos: FilaMision[];
  participantes: number;
  completaron: number;
  /** Alumno: qué pasos ya hizo. */
  yo?: { hechos: boolean[]; puesto: number | null };
}

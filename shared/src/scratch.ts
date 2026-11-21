// Taller de Scratch: cada alumno programa en el editor (TurboWarp, servido en /scratch)
// a partir de un proyecto inicial opcional, y entrega su .sb3. El profe ve quién entregó,
// descarga las entregas y muestra cualquiera en la pantalla grande.

export const LIMITES_SCRATCH = {
  titulo: 60,
  /** Un proyecto con muchos sonidos puede pesar bastante. */
  proyectoBytes: 50 * 1024 * 1024,
} as const;

/** Un .sb3 que subió el profe para arrancar talleres (queda en la lista para reusarlo). */
export interface ProyectoInicial {
  id: number;
  nombre: string;
  bytes: number;
  subidoEn: string;
}

export interface OpcionesScratch {
  titulo: string;
  /** Proyecto para arrancar (null = el proyecto nuevo del editor). */
  inicialId: number | null;
}

export type AccionScratch =
  /** Abre la entrega de ese alumno en el reproductor de la pantalla grande. */
  | { tipo: 'mostrar'; alumnoId: number }
  | { tipo: 'ocultar' };

export interface AutorScratch {
  alumnoId: number;
  nombre: string;
  avatar: string;
}

export interface EntregaScratch extends AutorScratch {
  conectado: boolean;
  /** Fecha de la última entrega (ISO) o null si todavía no entregó. */
  entregadaEn: string | null;
  bytes: number;
  /** Cuántas veces entregó (cada una reemplaza a la anterior). */
  veces: number;
}

export interface VistaScratch {
  tallerId: number;
  titulo: string;
  /** El proyecto inicial (null = el proyecto vacío del editor). */
  inicialUrl: string | null;
  inicialNombre: string | null;
  entregaron: number;
  /** Alumnos de la comisión (conectados o que ya entregaron). */
  total: number;
  /** Profe y pantalla: todos los alumnos, con su entrega. El alumno recibe la lista vacía. */
  entregas: EntregaScratch[];
  /** Entrega que se está viendo en la pantalla grande. */
  mostrando: (AutorScratch & { url: string; entregadaEn: string }) | null;
  /** Alumno: su última entrega, para retomarla si recarga la página. */
  miEntrega?: { url: string; entregadaEn: string; veces: number } | null;
}

import type { Ack, AlumnoConectado, EventoDrive, MapaActividades, RolSocket, TipoActividad } from '@aula/shared';

/** Lo que el control le da a cada actividad. */
export interface ContextoActividad {
  comisionId: number;
  comisionNombre: string;
  /**
   * Avisa que cambió algo. `inmediato` para los cambios de fase; si no, los avisos se juntan
   * (con 30 alumnos tipeando llegan decenas de progresos por segundo).
   */
  avisar: (inmediato?: boolean) => void;
  estaConectado: (alumnoId: number) => boolean;
  /** Alumnos de la comisión conectados ahora. */
  conectados: () => AlumnoConectado[];
}

/** Una actividad en curso. El control la crea, le pasa los mensajes y manda su vista a cada rol. */
export interface InstanciaActividad<T extends TipoActividad = TipoActividad> {
  readonly tipo: T;
  vista(rol: RolSocket, alumnoId?: number): MapaActividades[T]['vista'];
  accionProfe(accion: MapaActividades[T]['accion']): Ack;
  enviarAlumno(alumnoId: number, envio: MapaActividades[T]['envio']): Ack;
  alConectar(alumno: AlumnoConectado): void;
  alDesconectar(alumnoId: number): void;
  /** Un alumno de la comisión cambió algo en su Drive (lo usan las misiones). */
  alCambiarDrive?(alumnoId: number, evento: EventoDrive | null, itemId: number | null): void;
  /** Ya terminó (se están viendo los resultados): se puede reemplazar por otra cosa sin preguntar. */
  terminada(): boolean;
  destruir(): void;
  /** Lo que hace falta para retomarla si se reinicia el servidor (sin esto, se pierde al reiniciar). */
  guardar?(): unknown;
}

export interface ModuloActividad<T extends TipoActividad = TipoActividad> {
  crear(ctx: ContextoActividad, opciones: MapaActividades[T]['opciones']): InstanciaActividad<T> | { error: string };
  /** Vuelve a armarla con lo que devolvió `guardar()`. null si ya no se puede (por ejemplo, se borró algo). */
  restaurar?(ctx: ContextoActividad, datos: unknown): InstanciaActividad<T> | null;
}

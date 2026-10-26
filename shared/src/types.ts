// Modelos compartidos entre cliente y servidor.

export type NivelPassword = 'debil' | 'media' | 'fuerte' | 'muy-fuerte';

export interface Comision {
  id: number;
  nombre: string;
  cantidadAlumnos: number;
}

/** Lo que ve cualquiera en la pantalla de ingreso: nunca incluye el hash. */
export interface AlumnoPublico {
  id: number;
  comisionId: number;
  nombre: string;
  avatar: string;
  tienePassword: boolean;
}

export interface AlumnoConectado {
  id: number;
  comisionId: number;
  nombre: string;
  avatar: string;
}

/** comisionId → alumnos conectados ahora, en orden de llegada. */
export type Presencia = Record<number, AlumnoConectado[]>;

export interface ConfigPublica {
  nombreCurso: string;
  nivelMinimoPassword: NivelPassword;
  /** Ranking en la pantalla grande: todos o solo el top 3. */
  modoRanking: 'todos' | 'top3';
  /** Si al iniciar un quiz se suma bonus por racha de correctas. */
  bonusRacha: boolean;
}

export interface InfoServidor extends ConfigPublica {
  /** URL principal para unirse, por ejemplo http://192.168.0.15:3000 */
  url: string;
  urls: string[];
  /** QR de `url`, como data URL PNG generado localmente. */
  qr: string;
}

export interface SesionAlumno {
  token: string;
  alumno: AlumnoPublico;
}

export interface ApiError {
  error: string;
}

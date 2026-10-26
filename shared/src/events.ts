// Tipos de los eventos de Socket.IO. Cliente y servidor usan las mismas interfaces.
import type {
  AccionEncuesta,
  AccionPresentacion,
  AccionPreguntas,
  Atencion,
  ConteoSenales,
  EncuestaEnVivo,
  EstadoPresentacion,
  ManoLevantada,
  MiMano,
  MisSenales,
  PreguntaAnonima,
  TipoSenal,
} from './clase';
import type { AccionJuego, Ack, EstadoJuego } from './juego';
import type { RespuestaJuego } from './quiz';
import type { AlumnoPublico, ConfigPublica, Presencia } from './types';

export type RolSocket = 'alumno' | 'profe' | 'pantalla';

/** Lo que manda cada cliente en `io({ auth })` al conectarse. */
export interface SocketAuth {
  rol: RolSocket;
  token?: string;
}

export interface ServerToClientEvents {
  /** Alumnos conectados, por comisión. Lo reciben `profe` y `pantalla`. */
  'presencia:actualizar': (presencia: Presencia) => void;
  /** Confirma al alumno quién es, al conectarse. */
  'alumno:bienvenida': (alumno: AlumnoPublico) => void;
  /** El token dejó de valer (por ejemplo, el profe restauró la contraseña). */
  'sesion:expirada': () => void;
  'config:actualizar': (config: ConfigPublica) => void;
  /** Estado completo del juego en vivo (null = no hay juego). Se manda entero en cada cambio. */
  'juego:estado': (estado: EstadoJuego | null) => void;
  /** Presentación en vivo (null = no hay). Profe, pantalla y alumnos de esa comisión. */
  'presentacion:estado': (estado: EstadoPresentacion | null) => void;
  /** Profe: la fila de manos levantadas, en orden de llegada. */
  'manos:actualizar': (manos: ManoLevantada[]) => void;
  /** Alumno: su propia mano. */
  'mano:estado': (mano: MiMano) => void;
  /** Profe: cuántos avisaron "No entendí" / "Más despacio" (sin nombres). */
  'senales:actualizar': (conteo: ConteoSenales) => void;
  /** Alumno: sus propias señales activas. */
  'senales:mias': (mias: MisSenales) => void;
  /** Profe: preguntas anónimas pendientes. */
  'preguntas:actualizar': (preguntas: PreguntaAnonima[]) => void;
  /** Pantalla y profe: pregunta anónima que el profe muestra en grande (null = ninguna). */
  'pantalla:destacada': (texto: string | null) => void;
  /** Alumnos (y profe): "Miren al frente" activo o no. */
  'atencion:estado': (atencion: Atencion | null) => void;
  /** Encuesta rápida en curso (null = no hay). Cada rol recibe su vista. */
  'encuesta:estado': (encuesta: EncuestaEnVivo | null) => void;
}

export interface ClientToServerEvents {
  /** Alumno: responde la pregunta actual. */
  'juego:responder': (respuesta: RespuestaJuego, ack: (r: Ack) => void) => void;
  /** Profe: controles del juego. */
  'juego:control': (accion: AccionJuego, ack: (r: Ack) => void) => void;
  /** Profe: controles de la presentación. */
  'presentacion:control': (accion: AccionPresentacion, ack: (r: Ack) => void) => void;
  /** Alumno: levanta (true) o baja (false) su mano. */
  'mano:cambiar': (arriba: boolean, ack: (r: Ack) => void) => void;
  /** Profe: baja la mano de un alumno, o todas (null). */
  'manos:bajar': (alumnoId: number | null, ack: (r: Ack) => void) => void;
  /** Alumno: activa o desactiva una señal anónima. */
  'senal:cambiar': (cambio: { tipo: TipoSenal; activa: boolean }, ack: (r: Ack) => void) => void;
  /** Profe: pone en cero una señal (o las dos, con null). */
  'senales:limpiar': (tipo: TipoSenal | null, ack: (r: Ack) => void) => void;
  /** Alumno: manda una pregunta anónima. */
  'pregunta:enviar': (texto: string, ack: (r: Ack) => void) => void;
  /** Profe: borrar o mostrar en la pantalla una pregunta anónima. */
  'preguntas:accion': (accion: AccionPreguntas, ack: (r: Ack) => void) => void;
  /** Profe: activa (o apaga, con null) "Miren al frente". */
  'atencion:cambiar': (atencion: Atencion | null, ack: (r: Ack) => void) => void;
  /** Profe: encuesta rápida. */
  'encuesta:control': (accion: AccionEncuesta, ack: (r: Ack) => void) => void;
  /** Alumno: responde la encuesta (índice de opción, o texto). */
  'encuesta:responder': (valor: number | string, ack: (r: Ack) => void) => void;
}

export interface SocketData {
  rol: RolSocket;
  alumnoId?: number;
  comisionId?: number;
}

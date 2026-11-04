// Actividades de clase que se suman con el tiempo (tipeo, y después dibujo, simulaciones…).
// Todas usan los mismos eventos de Socket.IO; lo propio de cada una va en su `vista`, sus
// `opciones` al empezar, las `acciones` del profe y lo que `envia` el alumno.
import type { AccionMisiones, OpcionesMisiones, VistaMisiones } from './drive';
import type { AccionGaleria, OpcionesGaleria, VistaGaleria, VotoGaleria } from './galeria';
import type { AccionTipeo, OpcionesTipeo, ProgresoTipeo, VistaTipeo } from './tipeo';

/** Para sumar una actividad: agregar su entrada acá y en los registros del servidor y del cliente. */
export interface MapaActividades {
  tipeo: { opciones: OpcionesTipeo; accion: AccionTipeo; envio: ProgresoTipeo; vista: VistaTipeo };
  /** Misiones en el simulador de Drive: se tildan solas con lo que hace cada uno en su Drive. */
  drive: { opciones: OpcionesMisiones; accion: AccionMisiones; envio: null; vista: VistaMisiones };
  galeria: { opciones: OpcionesGaleria; accion: AccionGaleria; envio: VotoGaleria; vista: VistaGaleria };
}

export type TipoActividad = keyof MapaActividades;
export const TIPOS_ACTIVIDAD: readonly TipoActividad[] = ['tipeo', 'drive', 'galeria'];
export const NOMBRE_ACTIVIDAD: Record<TipoActividad, string> = { tipeo: 'Carrera de tipeo', drive: 'Misiones en Drive', galeria: 'Votación de dibujos' };

/** Lo que reciben profe, pantalla y cada alumno (con su propia vista). */
export type EstadoActividad = {
  [T in TipoActividad]: { tipo: T; comisionId: number; comisionNombre: string; vista: MapaActividades[T]['vista'] };
}[TipoActividad];

export type AccionActividad =
  | { [T in TipoActividad]: { tipo: 'iniciar'; actividad: T; comisionId: number; opciones: MapaActividades[T]['opciones'] } }[TipoActividad]
  /** Acción propia de la actividad en curso. */
  | { tipo: 'accion'; accion: MapaActividades[TipoActividad]['accion'] }
  /** Saca la actividad (vuelve todo a la sala de espera). */
  | { tipo: 'cerrar' };

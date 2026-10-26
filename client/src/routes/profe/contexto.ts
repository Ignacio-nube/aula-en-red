import { createContext, useContext } from 'react';
import type {
  AccionJuego,
  AccionPresentacion,
  Ack,
  Atencion,
  ConteoSenales,
  EncuestaEnVivo,
  EstadoJuego,
  EstadoPresentacion,
  PreguntaAnonima,
  Presencia,
} from '@aula/shared';
import type { api } from '@/lib/api';
import type { SocketAula } from '@/lib/socket';

export interface Profe {
  /** `api()` con el token del profe ya puesto. Si el token venció, cierra la sesión. */
  pedir: <T>(ruta: string, opciones?: Omit<Parameters<typeof api>[1], 'token'>) => Promise<T>;
  presencia: Presencia;
  /** Juego en vivo (null = no hay) y cuándo llegó el estado, para animar el tiempo. */
  juego: { estado: EstadoJuego | null; recibido: number };
  controlar: (accion: AccionJuego) => Promise<Ack>;
  presentacion: EstadoPresentacion | null;
  controlarPresentacion: (accion: AccionPresentacion) => Promise<Ack>;
  /** Presentación elegida desde la pestaña Presentaciones para arrancarla en Clase en vivo. */
  presentacionElegida: number | null;
  elegirPresentacion: (id: number | null) => void;
  /** Para los controles que no tienen atajo propio (encuesta, atención, preguntas). Usar con emitirConAck. */
  socket: SocketAula | null;
  senales: ConteoSenales;
  preguntas: PreguntaAnonima[];
  destacada: string | null;
  atencion: Atencion | null;
  encuesta: EncuestaEnVivo | null;
  /** Para avisar que hay cambios sin guardar antes de cambiar de pestaña. */
  irA: (pestana: string) => void;
}

export const ContextoProfe = createContext<Profe | null>(null);

export function useProfe(): Profe {
  const p = useContext(ContextoProfe);
  if (!p) throw new Error('useProfe fuera de <ProfeApp>');
  return p;
}

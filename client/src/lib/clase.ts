import { useEffect, useState } from 'react';
import type {
  Atencion,
  ConteoSenales,
  EncuestaEnVivo,
  EstadoPresentacion,
  ManoLevantada,
  MiMano,
  MisSenales,
  PreguntaAnonima,
  ServerToClientEvents,
} from '@aula/shared';
import type { SocketAula } from './socket';

/** Presentación en vivo (null = no hay, o es de otra comisión). */
export function usePresentacion(socket: SocketAula | null): EstadoPresentacion | null {
  const [estado, setEstado] = useState<EstadoPresentacion | null>(null);
  useEffect(() => {
    if (!socket) return;
    socket.on('presentacion:estado', setEstado);
    return () => {
      socket.off('presentacion:estado', setEstado);
    };
  }, [socket]);
  return estado;
}

/** Profe: la fila de manos levantadas. */
export function useManos(socket: SocketAula | null): ManoLevantada[] {
  const [manos, setManos] = useState<ManoLevantada[]>([]);
  useEffect(() => {
    if (!socket) return;
    socket.on('manos:actualizar', setManos);
    return () => {
      socket.off('manos:actualizar', setManos);
    };
  }, [socket]);
  return manos;
}

/** Alumno: su propia mano. */
export function useMiMano(socket: SocketAula | null): MiMano {
  const [mano, setMano] = useState<MiMano>({ arriba: false, puesto: null });
  useEffect(() => {
    if (!socket) return;
    socket.on('mano:estado', setMano);
    return () => {
      socket.off('mano:estado', setMano);
    };
  }, [socket]);
  return mano;
}

/** Escucha un evento del servidor y guarda el último valor. */
function useEvento<E extends keyof ServerToClientEvents>(
  socket: SocketAula | null,
  evento: E,
  inicial: Parameters<ServerToClientEvents[E]>[0],
): Parameters<ServerToClientEvents[E]>[0] {
  const [valor, setValor] = useState(inicial);
  useEffect(() => {
    if (!socket) return;
    const alRecibir = ((v: Parameters<ServerToClientEvents[E]>[0]) => setValor(v)) as ServerToClientEvents[E];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket.on as any)(evento, alRecibir);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket.off as any)(evento, alRecibir);
    };
  }, [socket, evento]);
  return valor;
}

const SIN_SENALES: ConteoSenales = { noEntendi: 0, despacio: 0 };
const MIS_SENALES: MisSenales = { noEntendi: false, despacio: false };

export const useSenales = (s: SocketAula | null) => useEvento(s, 'senales:actualizar', SIN_SENALES);
export const useMisSenales = (s: SocketAula | null) => useEvento(s, 'senales:mias', MIS_SENALES);
export const usePreguntasAnonimas = (s: SocketAula | null) => useEvento(s, 'preguntas:actualizar', [] as PreguntaAnonima[]);
export const useDestacada = (s: SocketAula | null) => useEvento(s, 'pantalla:destacada', null);
export const useAtencion = (s: SocketAula | null) => useEvento(s, 'atencion:estado', null as Atencion | null);
export const useEncuesta = (s: SocketAula | null) => useEvento(s, 'encuesta:estado', null as EncuestaEnVivo | null);

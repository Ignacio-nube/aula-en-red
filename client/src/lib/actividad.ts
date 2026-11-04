import { useEffect, useState } from 'react';
import type { EstadoActividad } from '@aula/shared';
import type { SocketAula } from './socket';

export interface ActividadRecibida {
  estado: EstadoActividad | null;
  /** performance.now() cuando llegó, para animar los tiempos con el reloj de cada compu. */
  recibido: number;
}

/** Actividad en curso (tipeo, etc.). `estado: null` = no hay. */
export function useActividad(socket: SocketAula | null): ActividadRecibida {
  const [actual, setActual] = useState<ActividadRecibida>({ estado: null, recibido: 0 });
  useEffect(() => {
    if (!socket) return;
    const alEstado = (estado: EstadoActividad | null) => setActual({ estado, recibido: performance.now() });
    socket.on('actividad:estado', alEstado);
    return () => {
      socket.off('actividad:estado', alEstado);
    };
  }, [socket]);
  return actual;
}

/** Un tiempo que manda el servidor (ms que faltan), descontado con el reloj local. Se actualiza solo. */
export function useCuentaAtras(ms: number | null, recibido: number, cadaMs = 200): number | null {
  const calcular = () => (ms === null ? null : Math.max(0, ms - (performance.now() - recibido)));
  const [restante, setRestante] = useState(calcular);
  useEffect(() => {
    setRestante(calcular());
    if (ms === null) return;
    const id = setInterval(() => setRestante(calcular()), cadaMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, recibido, cadaMs]);
  return restante;
}

export function formatoReloj(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

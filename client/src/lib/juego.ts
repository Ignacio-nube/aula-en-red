import { useEffect, useRef, useState } from 'react';
import type { Ack, ClientToServerEvents, EstadoJuego } from '@aula/shared';
import type { SocketAula } from './socket';

interface EstadoRecibido {
  estado: EstadoJuego | null;
  /** performance.now() cuando llegó: el cliente anima con su propio reloj desde ahí. */
  recibido: number;
}

/** Estado del juego que manda el servidor. `null` = no hay juego. */
export function useJuego(socket: SocketAula | null): EstadoRecibido {
  const [recibido, setRecibido] = useState<EstadoRecibido>({ estado: null, recibido: 0 });
  useEffect(() => {
    if (!socket) return;
    const alEstado = (estado: EstadoJuego | null) => setRecibido({ estado, recibido: performance.now() });
    socket.on('juego:estado', alEstado);
    return () => {
      socket.off('juego:estado', alEstado);
    };
  }, [socket]);
  return recibido;
}

/**
 * Milisegundos que quedan de la pregunta, animados localmente. El servidor manda cuánto falta
 * (no una hora), así no importa que el reloj de cada PC esté corrido.
 */
export function useRestante({ estado, recibido }: EstadoRecibido): number {
  const activo = estado?.fase === 'pregunta' && !estado.pausado;
  const base = estado?.restanteMs ?? 0;
  const calcular = () => (activo ? Math.max(0, base - (performance.now() - recibido)) : base);
  const [restante, setRestante] = useState(calcular);
  const raf = useRef(0);

  useEffect(() => {
    setRestante(calcular());
    if (!activo) return;
    const tick = () => {
      const r = calcular();
      setRestante(r);
      if (r > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, base, recibido]);

  return estado?.fase === 'pregunta' ? restante : 0;
}

/** Eventos que el servidor contesta con un `Ack`. */
type EventoConAck = {
  [E in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[E]> extends [unknown, (r: Ack) => void] ? E : never;
}[keyof ClientToServerEvents];

export function emitirConAck<E extends EventoConAck>(
  socket: SocketAula | null,
  evento: E,
  dato: Parameters<ClientToServerEvents[E]>[0],
): Promise<Ack> {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: 'Sin conexión con el servidor. Esperá un momento.' });
    const t = setTimeout(() => resolve({ ok: false, error: 'El servidor no respondió. Probá de nuevo.' }), 8000);
    const ack = (r: Ack) => {
      clearTimeout(t);
      resolve(r);
    };
    (socket.emit as unknown as (e: E, d: typeof dato, a: typeof ack) => void).call(socket, evento, dato, ack);
  });
}

export const urlImagen = (archivo: string) => `/uploads/${encodeURIComponent(archivo)}`;

export function ordinal(n: number): string {
  return `${n}.º`;
}

export function formatoPuntos(n: number): string {
  return n.toLocaleString('es-AR');
}

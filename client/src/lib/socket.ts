import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, Presencia, ServerToClientEvents, SocketAuth } from '@aula/shared';

export type SocketAula = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Mismo origen que la página: el server de Express sirve la app y el socket. */
export function conectar(auth: SocketAuth): SocketAula {
  return io({ auth, transports: ['websocket', 'polling'] });
}

/** Socket abierto mientras el componente esté montado. `null` hasta conectar. */
export function useSocket(auth: SocketAuth | null): SocketAula | null {
  const [socket, setSocket] = useState<SocketAula | null>(null);
  const rol = auth?.rol;
  const token = auth?.token;

  useEffect(() => {
    if (!rol) return;
    const s = conectar({ rol, token });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [rol, token]);

  return socket;
}

export function useConectado(socket: SocketAula | null): boolean {
  const [conectado, setConectado] = useState(socket?.connected ?? false);
  useEffect(() => {
    if (!socket) return;
    setConectado(socket.connected);
    const si = () => setConectado(true);
    const no = () => setConectado(false);
    socket.on('connect', si);
    socket.on('disconnect', no);
    return () => {
      socket.off('connect', si);
      socket.off('disconnect', no);
    };
  }, [socket]);
  return conectado;
}

export function usePresencia(socket: SocketAula | null): Presencia {
  const [presencia, setPresencia] = useState<Presencia>({});
  useEffect(() => {
    if (!socket) return;
    socket.on('presencia:actualizar', setPresencia);
    return () => {
      socket.off('presencia:actualizar', setPresencia);
    };
  }, [socket]);
  return presencia;
}

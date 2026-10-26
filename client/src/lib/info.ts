import { useEffect, useState } from 'react';
import type { InfoServidor } from '@aula/shared';
import { api } from './api';
import type { SocketAula } from './socket';

/** Datos del servidor (IP, QR, nombre del curso, nivel mínimo). Se refrescan cada tanto
 *  por si la notebook cambia de red, y al instante si el profe cambia la config. */
export function useInfo(socket?: SocketAula | null, cadaMs = 30_000): InfoServidor | null {
  const [info, setInfo] = useState<InfoServidor | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      api<InfoServidor>('/info')
        .then((i) => vivo && setInfo(i))
        .catch(() => {});
    void cargar();
    const id = window.setInterval(cargar, cadaMs);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [cadaMs]);

  useEffect(() => {
    if (!socket) return;
    const alCambiar = (config: Pick<InfoServidor, 'nombreCurso' | 'nivelMinimoPassword'>) =>
      setInfo((i) => (i ? { ...i, ...config } : i));
    socket.on('config:actualizar', alCambiar);
    return () => {
      socket.off('config:actualizar', alCambiar);
    };
  }, [socket]);

  return info;
}

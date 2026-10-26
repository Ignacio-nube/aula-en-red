import { useSyncExternalStore } from 'react';

/** Celular parado (angosto) o acostado (bajito): para achicar cosas que se dimensionan en px. */
const CONSULTA = '(max-width: 639px), (max-height: 500px)';

export function useCompacto(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(CONSULTA).matches,
  );
}

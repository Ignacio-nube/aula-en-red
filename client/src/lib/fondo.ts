// El fondo de la sala de espera, que elige cada alumno. Es una preferencia de cada compu (queda en
// su localStorage), como el tema y el modo liviano.
import { useSyncExternalStore } from 'react';
import { CLAVES, guardar, leer } from './almacen';

export const FONDOS = ['estanque', 'espacio', 'aurora'] as const;
export type Fondo = (typeof FONDOS)[number];

export const NOMBRE_FONDO: Record<Fondo, string> = { estanque: 'Estanque', espacio: 'Espacio', aurora: 'Aurora' };
export const EMOJI_FONDO: Record<Fondo, string> = { estanque: '🐟', espacio: '🪐', aurora: '✨' };
/** Qué se puede hacer con cada fondo mientras se espera. */
export const AYUDA_FONDO: Record<Fondo, string> = {
  estanque: 'Mientras tanto, tocá el agua para darles de comer a los peces.',
  espacio: 'Mientras tanto, tocá el cielo para lanzar estrellas fugaces.',
  aurora: 'Mientras tanto, pasá el dedo o el mouse por las luces.',
};

/** La utilidad de CSS con el color de cada fondo (index.css). El espacio tiene una de día y otra de noche. */
export function claseFondo(f: Fondo, oscuro: boolean): string {
  return f === 'estanque' ? 'bg-estanque' : f === 'aurora' ? 'bg-aurora' : oscuro ? 'bg-espacio-noche' : 'bg-espacio';
}

const oyentes = new Set<() => void>();
const valido = (v: string | null): Fondo => FONDOS.find((f) => f === v) ?? 'estanque';
let fondo: Fondo = valido(leer(CLAVES.fondo));

export function cambiarFondo(f: Fondo): void {
  fondo = f;
  guardar(CLAVES.fondo, f === 'estanque' ? null : f);
  oyentes.forEach((o) => o());
}

window.addEventListener('storage', (e) => {
  if (e.key !== CLAVES.fondo) return;
  fondo = valido(e.newValue);
  oyentes.forEach((o) => o());
});

export function useFondo(): Fondo {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => fondo,
  );
}

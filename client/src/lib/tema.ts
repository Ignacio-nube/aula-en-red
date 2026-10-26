// Modo oscuro: "auto" sigue al sistema operativo; "claro" y "oscuro" lo fijan. Es una preferencia
// de cada compu (queda en su localStorage), como el modo liviano.
import { useSyncExternalStore } from 'react';
import { CLAVES, guardar, leer } from './almacen';

export type PreferenciaTema = 'auto' | 'claro' | 'oscuro';

const oyentes = new Set<() => void>();
const sistema = window.matchMedia('(prefers-color-scheme: dark)');
let preferencia: PreferenciaTema = (['auto', 'claro', 'oscuro'] as const).find((t) => t === leer(CLAVES.tema)) ?? 'auto';

function oscuro(): boolean {
  return preferencia === 'oscuro' || (preferencia === 'auto' && sistema.matches);
}

function aplicar() {
  document.documentElement.classList.toggle('dark', oscuro());
  document.documentElement.style.colorScheme = oscuro() ? 'dark' : 'light';
  oyentes.forEach((f) => f());
}
aplicar();
sistema.addEventListener('change', aplicar);
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVES.tema) return;
  preferencia = (e.newValue as PreferenciaTema | null) ?? 'auto';
  aplicar();
});

export function cambiarTema(t: PreferenciaTema): void {
  preferencia = t;
  guardar(CLAVES.tema, t === 'auto' ? null : t);
  aplicar();
}

/** Cicla automático → claro → oscuro (para un solo botón). */
export function siguienteTema(t: PreferenciaTema): PreferenciaTema {
  return t === 'auto' ? 'claro' : t === 'claro' ? 'oscuro' : 'auto';
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
};

export function useTema(): { preferencia: PreferenciaTema; oscuro: boolean } {
  const p = useSyncExternalStore(suscribir, () => preferencia);
  const o = useSyncExternalStore(suscribir, oscuro);
  return { preferencia: p, oscuro: o };
}

export const NOMBRE_TEMA: Record<PreferenciaTema, string> = { auto: 'Automático (como la compu)', claro: 'Claro', oscuro: 'Oscuro' };

// Modo oscuro: "auto" sigue al sistema operativo; "claro" y "oscuro" lo fijan. Es una preferencia
// de cada compu (queda en su localStorage), como el modo liviano.
import { useSyncExternalStore } from 'react';
import { CLAVES, guardar, leer } from './almacen';
import { esLiviano } from './liviano';

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
  // La barra del navegador del celu, del mismo color que el fondo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro() ? '#0d141c' : '#f6f8fa');
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

type ConTransicion = { startViewTransition?: (cambio: () => void) => { ready: Promise<void>; finished: Promise<void> } };

/**
 * Cambia el tema abriendo el nuevo en círculo desde un punto (el interruptor). Si el navegador no lo
 * soporta, en modo liviano o si la compu pide menos movimiento, cambia directo.
 */
export function cambiarTemaDesde(t: PreferenciaTema, x: number, y: number): void {
  const doc = document as unknown as ConTransicion;
  if (!doc.startViewTransition || esLiviano() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cambiarTema(t);
    return;
  }
  const raiz = document.documentElement;
  raiz.classList.add('cambiando-tema');
  const transicion = doc.startViewTransition.call(document, () => cambiarTema(t));
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  transicion.ready
    .then(() => {
      raiz.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        { duration: 480, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
  void transicion.finished.catch(() => {}).then(() => raiz.classList.remove('cambiando-tema'));
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

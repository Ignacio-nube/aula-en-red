// Modo liviano, para PCs lentas: sin vidrio esmerilado, con menos animaciones y diapositivas
// dibujadas a menor resolución. Es una preferencia de cada compu (queda en su localStorage).
import { useSyncExternalStore } from 'react';
import { CLAVES, guardar, leer } from './almacen';

const oyentes = new Set<() => void>();
let activo = leer(CLAVES.liviano) === '1';

function aplicar() {
  document.documentElement.classList.toggle('liviano', activo);
}
aplicar();

export function esLiviano(): boolean {
  return activo;
}

export function cambiarLiviano(valor: boolean): void {
  activo = valor;
  guardar(CLAVES.liviano, valor ? '1' : null);
  aplicar();
  oyentes.forEach((f) => f());
}

// Si se cambia en otra pestaña de la misma compu, esta también se entera.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVES.liviano) return;
  activo = e.newValue === '1';
  aplicar();
  oyentes.forEach((f) => f());
});

export function useLiviano(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => activo,
  );
}

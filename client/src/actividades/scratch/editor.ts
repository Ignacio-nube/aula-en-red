// El editor de Scratch (TurboWarp) se sirve en /scratch, en el mismo origen que la app, y corre
// en un iframe. Como es del mismo origen, la página de afuera llega a su máquina virtual
// (TurboWarp la deja en `window.vm`): con ella carga el proyecto y saca el .sb3 para entregarlo.

import { useEffect, useRef, useState } from 'react';

/** Lo que usamos de la VM de Scratch. */
export interface VmScratch {
  loadProject(datos: ArrayBuffer): Promise<void>;
  saveProjectSb3(): Promise<Blob>;
  greenFlag(): void;
  start(): void;
  stopAll(): void;
  on(evento: string, fn: () => void): void;
  off(evento: string, fn: () => void): void;
  runtime: { targets: unknown[] };
}

/** Español de Latinoamérica, que está entre los idiomas de Scratch. */
const IDIOMA = 'es-419';
export const URL_EDITOR = `/scratch/editor.html?locale=${IDIOMA}`;
// Con #0 el reproductor arranca con el proyecto vacío: después le cargamos el que corresponde.
export const URL_REPRODUCTOR = `/scratch/embed.html?locale=${IDIOMA}#0`;

const ESPERA_MAXIMA_MS = 60_000;

/**
 * Espera a que el editor del iframe tenga su VM y termine de cargar su proyecto vacío.
 * Si le cargáramos el nuestro antes, el vacío lo pisaría al terminar.
 */
function esperarVm(iframe: HTMLIFrameElement, cancelado: () => boolean): Promise<VmScratch> {
  const inicio = Date.now();
  return new Promise((resolver, rechazar) => {
    const mirar = () => {
      if (cancelado()) return;
      let vm: VmScratch | undefined;
      try {
        vm = (iframe.contentWindow as (Window & { vm?: VmScratch }) | null)?.vm;
      } catch {
        // todavía no es del mismo origen (about:blank)
      }
      if (vm && vm.runtime.targets.length > 0) return resolver(vm);
      // El servidor contesta con un aviso si nunca se compiló el editor (npm run scratch:compilar).
      try {
        if (iframe.contentDocument?.body?.hasAttribute('data-falta-scratch')) {
          return rechazar(new Error('Falta instalar el editor de Scratch en la compu del profe. Avisale al profe.'));
        }
      } catch {
        // todavía no es del mismo origen
      }
      if (Date.now() - inicio > ESPERA_MAXIMA_MS) return rechazar(new Error('El editor de Scratch no terminó de cargar.'));
      setTimeout(mirar, 150);
    };
    mirar();
  });
}

export type EstadoEditor = { fase: 'cargando' } | { fase: 'listo'; vm: VmScratch } | { fase: 'error'; mensaje: string };

/**
 * Engancha un iframe del editor o del reproductor: cuando está listo, le carga `url`
 * (o lo deja con el proyecto vacío si es null). Vuelve a cargar si cambia la URL.
 */
export function useEditorScratch(url: string | null, alCargar?: (vm: VmScratch) => void) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [estado, setEstado] = useState<EstadoEditor>({ fase: 'cargando' });
  const alCargarRef = useRef(alCargar);
  alCargarRef.current = alCargar;

  useEffect(() => {
    const el = iframe.current;
    if (!el) return;
    let cancelado = false;
    setEstado({ fase: 'cargando' });
    (async () => {
      const vm = await esperarVm(el, () => cancelado);
      if (url) {
        // Se baja con el fetch del iframe: la VM chequea `instanceof ArrayBuffer` contra el ArrayBuffer
        // de su propia ventana, y uno creado acá afuera no pasa ese chequeo.
        const ventana = el.contentWindow as (Window & typeof globalThis) | null;
        if (!ventana) throw new Error('El editor de Scratch no terminó de cargar.');
        const res = await ventana.fetch(url);
        if (!res.ok) throw new Error('No se encontró el proyecto.');
        await vm.loadProject(await res.arrayBuffer());
      }
      if (cancelado) return;
      alCargarRef.current?.(vm);
      setEstado({ fase: 'listo', vm });
    })().catch((err: unknown) => {
      if (cancelado) return;
      console.error(err);
      setEstado({ fase: 'error', mensaje: err instanceof Error ? err.message : 'No se pudo abrir el proyecto.' });
    });
    return () => {
      cancelado = true;
    };
  }, [url]);

  return { iframe, estado };
}

/** Sube el .sb3 del alumno. */
export async function entregarProyecto(vm: VmScratch, token: string): Promise<void> {
  const sb3 = await vm.saveProjectSb3();
  let res: Response;
  try {
    res = await fetch('/api/scratch/entregas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: sb3,
    });
  } catch {
    throw new Error('No hay conexión con la compu del profe. Revisá que estés en la misma red.');
  }
  if (!res.ok) {
    const datos = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(datos?.error ?? 'No se pudo entregar. Probá de nuevo.');
  }
}

export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

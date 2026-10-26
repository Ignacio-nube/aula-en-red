// pdf.js, todo local: el worker sale del build (no de un CDN) y los recursos extra de /pdfjs/.
// Se usa la versión "legacy", que anda también en navegadores que no son los últimos.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import urlWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useEffect, useState } from 'react';
import { esLiviano } from './liviano';

GlobalWorkerOptions.workerSrc = urlWorker;

const RECURSOS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
  isEvalSupported: false,
};

export const urlPresentacion = (archivo: string) => `/presentaciones/${encodeURIComponent(archivo)}`;

/** Abre un PDF elegido en la compu (antes de subirlo) para contar las páginas y ver que se lee. */
export async function leerPdfLocal(archivo: File): Promise<{ paginas: number; doc: PDFDocumentProxy; cerrar: () => void }> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const tarea = getDocument({ data: datos, ...RECURSOS });
  const doc = await tarea.promise;
  return { paginas: doc.numPages, cerrar: () => void tarea.destroy().catch(() => {}), doc };
}

// --- documentos abiertos ------------------------------------------------------
// Quedan abiertos los últimos que se usaron: volver a una presentación (o tenerla en el panel y en
// la vista previa a la vez) no la descarga ni la procesa de nuevo. Uno que se está mostrando nunca
// se cierra.

interface Abierto {
  promesa: Promise<PDFDocumentProxy>;
  cerrar: () => void;
  usos: number;
}
const documentos = new Map<string, Abierto>();
const MAX_SIN_USO = 2;

function abrir(url: string): Abierto {
  let abierto = documentos.get(url);
  if (abierto) {
    documentos.delete(url);
  } else {
    const tarea = getDocument({ url, ...RECURSOS });
    abierto = { promesa: tarea.promise, cerrar: () => void tarea.destroy().catch(() => {}), usos: 0 };
    abierto.promesa.catch(() => documentos.delete(url));
  }
  documentos.set(url, abierto); // al final: el más reciente
  return abierto;
}

function liberarSobrantes(): void {
  const sinUso = [...documentos].filter(([, a]) => a.usos === 0);
  for (const [url, a] of sinUso.slice(0, Math.max(0, sinUso.length - MAX_SIN_USO))) {
    documentos.delete(url);
    a.cerrar();
    renderizadas.forEach((_, clave) => clave.startsWith(`${url}#`) && renderizadas.delete(clave));
  }
}

export function useDocumentoPdf(url: string | null): { doc: PDFDocumentProxy | null; error: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; doc: PDFDocumentProxy | null; error: boolean }>({
    url: null,
    doc: null,
    error: false,
  });
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    const abierto = abrir(url);
    abierto.usos++;
    abierto.promesa.then(
      (doc) => vivo && setEstado({ url, doc, error: false }),
      () => vivo && setEstado({ url, doc: null, error: true }),
    );
    return () => {
      vivo = false;
      abierto.usos--;
      liberarSobrantes();
    };
  }, [url]);
  return estado.url === url ? estado : { doc: null, error: false };
}

// --- portadas -----------------------------------------------------------------
// Para la lista de presentaciones: la primera página como imagen chica. Se abren de a una y se
// cierran enseguida, así una lista larga no llena la memoria.

const portadas = new Map<string, Promise<string>>();
let cola: Promise<unknown> = Promise.resolve();

export function portada(url: string, ancho = 480): Promise<string> {
  let p = portadas.get(url);
  if (p) return p;
  p = (async () => {
    await cola.catch(() => {});
    const tarea = getDocument({ url, ...RECURSOS });
    try {
      const page = await (await tarea.promise).getPage(1);
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: ancho / vp1.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (!blob) throw new Error('sin imagen');
      return URL.createObjectURL(blob);
    } finally {
      void tarea.destroy().catch(() => {});
    }
  })();
  cola = p;
  p.catch(() => portadas.delete(url));
  portadas.set(url, p);
  return p;
}

// --- páginas dibujadas --------------------------------------------------------
// Cada diapositiva se dibuja una vez por tamaño y queda guardada: pasar a la siguiente (que ya
// se dibujó por adelantado) o volver a la anterior es instantáneo.

const renderizadas = new Map<string, Promise<HTMLCanvasElement>>();
const MAX_RENDERIZADAS = 24;
/** Tope de píxeles por lienzo, para no agotar la memoria en PCs modestas. */
const MAX_PIXELES = 4096 * 2304;

export interface Tamano {
  ancho: number;
  alto: number;
}

/** Tamaño en px CSS que ocupa la página entrando entera en `caja` (sin deformarla). */
export async function tamanoPagina(doc: PDFDocumentProxy, pagina: number, caja: Tamano): Promise<Tamano> {
  const vp = (await doc.getPage(pagina)).getViewport({ scale: 1 });
  const escala = Math.min(caja.ancho / vp.width, caja.alto / vp.height);
  return { ancho: Math.floor(vp.width * escala), alto: Math.floor(vp.height * escala) };
}

export function dibujarPagina(doc: PDFDocumentProxy, url: string, pagina: number, caja: Tamano): Promise<HTMLCanvasElement> {
  // En modo liviano se dibuja a resolución 1×: tarda menos y usa menos memoria.
  const dpr = esLiviano() ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const clave = `${url}#${pagina}@${Math.round(caja.ancho)}x${Math.round(caja.alto)}x${dpr}`;
  const guardada = renderizadas.get(clave);
  if (guardada) {
    renderizadas.delete(clave);
    renderizadas.set(clave, guardada);
    return guardada;
  }

  const promesa = (async () => {
    const page = await doc.getPage(pagina);
    const vp1 = page.getViewport({ scale: 1 });
    const escalaCss = Math.min(caja.ancho / vp1.width, caja.alto / vp1.height);
    let escala = escalaCss * dpr;
    if (vp1.width * vp1.height * escala * escala > MAX_PIXELES) escala = Math.sqrt(MAX_PIXELES / (vp1.width * vp1.height));
    const vp = page.getViewport({ scale: escala });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp1.width * escalaCss)}px`;
    canvas.style.height = `${Math.floor(vp1.height * escalaCss)}px`;
    await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
    return canvas;
  })();
  promesa.catch(() => renderizadas.delete(clave));
  renderizadas.set(clave, promesa);
  while (renderizadas.size > MAX_RENDERIZADAS) renderizadas.delete(renderizadas.keys().next().value!);
  return promesa;
}

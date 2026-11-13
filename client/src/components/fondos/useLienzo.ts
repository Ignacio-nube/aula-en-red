// El ciclo de vida de un fondo dibujado en canvas: tamaño, cuadros, pausa y puntero. Es lo mismo que
// hace el estanque (components/estanque/Estanque.tsx), separado para los otros fondos.
import { useEffect, useRef } from 'react';

/** Lo que dibuja un fondo. Las medidas son en px de CSS. */
export interface Escena {
  redimensionar(ancho: number, alto: number): void;
  /** Cambia la paleta entre claro y oscuro. */
  tema(oscuro: boolean): void;
  /** Avanza `dt` segundos. */
  paso(dt: number): void;
  dibujar(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void;
  /** El mouse (no el dedo) se movió; `activo` es false cuando salió. */
  puntero?(x: number, y: number, activo: boolean): void;
  /** Un toque o clic en un lugar vacío. */
  toque?(x: number, y: number): void;
}

// Los toques sobre botones, enlaces y menús no son para el fondo.
const INTERACTIVO = "a, button, input, textarea, select, label, [role='button'], [role='dialog'], [role='menu'], [data-koi-ignore]";
const DT_MAXIMO = 0.05;

export function useLienzo(crear: () => Escena, { oscuro, pausado }: { oscuro: boolean; pausado: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const escenaRef = useRef<Escena | null>(null);
  const programarRef = useRef<() => void>(() => {});
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const oscuroRef = useRef(oscuro);
  oscuroRef.current = oscuro;
  const crearRef = useRef(crear);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const escena = crearRef.current();
    escena.tema(oscuroRef.current);
    escenaRef.current = escena;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let ancho = 0;
    let alto = 0;
    let raf = 0;
    let ultimo = 0;
    let visible = true;

    const dibujar = () => {
      if (ancho < 1 || alto < 1) return;
      ctx.clearRect(0, 0, ancho, alto);
      escena.dibujar(ctx, ancho, alto);
    };
    const cuadro = (ahora: number) => {
      escena.paso(Math.min(DT_MAXIMO, (ahora - ultimo) / 1000));
      ultimo = ahora;
      dibujar();
      raf = requestAnimationFrame(cuadro);
    };
    const programar = () => {
      cancelAnimationFrame(raf);
      if (pausadoRef.current || !visible || document.hidden) return;
      // Con menos movimiento: un solo cuadro quieto.
      if (reducido.matches) {
        dibujar();
        return;
      }
      ultimo = performance.now();
      raf = requestAnimationFrame(cuadro);
    };
    programarRef.current = () => {
      // Al cambiar de tema estando en pausa, igual hay que redibujar una vez.
      dibujar();
      programar();
    };

    const medir = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = r.width;
      alto = r.height;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      escena.redimensionar(ancho, alto);
      dibujar();
    };
    const tamano = new ResizeObserver(medir);
    tamano.observe(canvas);
    const enVista = new IntersectionObserver(([entrada]) => {
      visible = entrada!.isIntersecting;
      programar();
    });
    enVista.observe(canvas);

    const local = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      return { x, y, adentro: x >= 0 && y >= 0 && x <= r.width && y <= r.height };
    };
    const alMover = (e: PointerEvent) => {
      const { x, y, adentro } = local(e);
      escena.puntero?.(x, y, adentro && e.pointerType !== 'touch');
    };
    const alSalir = () => escena.puntero?.(0, 0, false);
    const alClic = (e: MouseEvent) => {
      if (reducido.matches || pausadoRef.current) return;
      if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVO))) return;
      const { x, y, adentro } = local(e);
      if (adentro) escena.toque?.(x, y);
    };

    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('click', alClic);
    window.addEventListener('blur', alSalir);
    document.documentElement.addEventListener('pointerleave', alSalir);
    document.addEventListener('visibilitychange', programar);
    reducido.addEventListener('change', programar);
    medir();
    programar();

    return () => {
      cancelAnimationFrame(raf);
      tamano.disconnect();
      enVista.disconnect();
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('click', alClic);
      window.removeEventListener('blur', alSalir);
      document.documentElement.removeEventListener('pointerleave', alSalir);
      document.removeEventListener('visibilitychange', programar);
      reducido.removeEventListener('change', programar);
      escenaRef.current = null;
      programarRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    escenaRef.current?.tema(oscuro);
    programarRef.current();
  }, [oscuro]);

  useEffect(() => {
    programarRef.current();
  }, [pausado]);

  return ref;
}

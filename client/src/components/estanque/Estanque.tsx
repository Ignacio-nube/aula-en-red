// Estanque de kois, de Dao Ho (https://github.com/Dao-Ho/portfolio, src/app/components/koi-pond/koi-pond.tsx),
// que lo compartió para uso libre. Adaptado: sin next-themes ni PostHog (usa el tema de la app) y sin
// useEffectEvent (con una ref), para React 19.1. Tocar el agua les tira comida a los peces.
import { useEffect, useRef } from 'react';
import { useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';
import { KoiRenderer } from './renderer';
import { World, type Box } from './world';

export type PondStats = { koi: number; pellets: number };

const STEP = 1 / 60;
const MAX_STEPS = 4;
const INTERACTIVE = "a, button, input, textarea, select, label, [role='button'], [role='dialog'], [data-koi-ignore]";
// Content over the pond carries this attribute; koi steer around it and fade beneath it.
const AVOID_TARGETS = '[data-koi-avoid]';
// Re-measure the content boxes this often, in frames, to follow layout shifts and entrance animations.
const MEASURE_EVERY_FRAMES = 30;
// Content boxes closer than this merge, so koi aren't squeezed into the slot between them.
const MERGE_GAP_PX = 160;

function mergeNearby(boxes: Box[]) {
  const merged: Box[] = [];
  for (const b of [...boxes].sort((p, q) => p.top - q.top)) {
    const near = merged.find((m) => b.top - m.bottom < MERGE_GAP_PX && b.left - m.right < MERGE_GAP_PX && m.left - b.right < MERGE_GAP_PX);
    if (!near) {
      merged.push({ ...b });
      continue;
    }
    near.left = Math.min(near.left, b.left);
    near.right = Math.max(near.right, b.right);
    near.bottom = Math.max(near.bottom, b.bottom);
  }
  return merged;
}

class PondEngine {
  private world = new World();
  private renderer: KoiRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private lastPointerTime = 0;
  private reported: PondStats = { koi: -1, pellets: -1 };
  private visible = true;
  private disposed = false;
  /** Con un diálogo abierto encima no se dibuja: el difuminado del fondo se recalcularía en cada cuadro. */
  private paused = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private resizeObserver = new ResizeObserver(() => this.resize());
  private intersectionObserver = new IntersectionObserver(([entry]) => {
    this.visible = entry!.isIntersecting;
    this.schedule();
  });

  constructor(
    private canvas: HTMLCanvasElement,
    private onStats: (stats: PondStats) => void,
  ) {
    this.renderer = new KoiRenderer(canvas);
    this.resizeObserver.observe(canvas);
    this.intersectionObserver.observe(canvas);
    this.reducedMotion.addEventListener('change', this.schedule);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('click', this.onClick);
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('blur', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.schedule);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener('change', this.schedule);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('click', this.onClick);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.schedule);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.schedule();
  }

  setTheme(isLight: boolean) {
    this.renderer.setTheme(isLight);
    if (this.reducedMotion.matches) this.drawStill();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    this.world.resize(rect.width, rect.height);
    this.measureContent();
    this.report();
    if (this.reducedMotion.matches) this.drawStill();
  }

  // Only call back when a count changes, so the page doesn't re-render every frame.
  private report() {
    const koi = this.world.koi.length;
    const pellets = this.world.pellets.length;
    if (koi === this.reported.koi && pellets === this.reported.pellets) return;
    this.reported = { koi, pellets };
    this.onStats(this.reported);
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.paused || !this.visible || document.hidden) return;
    if (this.reducedMotion.matches) {
      this.drawStill();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private measureContent() {
    const origin = this.canvas.getBoundingClientRect();
    const measured = Array.from(document.querySelectorAll(AVOID_TARGETS), (el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.height > 0)
      .map((b) => ({
        left: b.left - origin.left,
        top: b.top - origin.top,
        right: b.right - origin.left,
        bottom: b.bottom - origin.top,
      }));
    const boxes = mergeNearby(measured);
    this.renderer.setDimBoxes(boxes);
    this.world.avoid = boxes;
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    if (++this.frames % MEASURE_EVERY_FRAMES === 0) this.measureContent();
    this.renderer.render(this.world, dt);
    this.report();
    this.raf = requestAnimationFrame(this.frame);
  };

  // Reduced motion: let the koi spread out, then hold a single frame.
  private drawStill() {
    if (this.world.time < 4) {
      for (let i = 0; i < 240; i++) this.world.step(STEP);
    }
    this.measureContent();
    this.renderer.render(this.world, STEP);
    this.report();
  }

  private toLocal(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
  }

  private onPointerMove = (e: PointerEvent) => {
    const { x, y, inside } = this.toLocal(e);
    const p = this.world.pointer;
    const elapsed = Math.max(1, e.timeStamp - this.lastPointerTime) / 1000;
    const speed = Math.hypot(x - p.x, y - p.y) / elapsed;
    p.speed += (Math.min(speed, 5000) - p.speed) * 0.5;
    this.lastPointerTime = e.timeStamp;
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== 'touch';
  };

  // Clicks on empty space drop food; links, buttons, and text selection are left alone.
  private onClick = (e: MouseEvent) => {
    if (this.reducedMotion.matches) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) return;
    if (window.getSelection()?.toString()) return;
    const { x, y, inside } = this.toLocal(e);
    if (!inside) return;
    this.world.feed(x, y);
    this.report();
  };

  private onPointerLeave = () => {
    this.world.pointer.active = false;
    this.world.pointer.speed = 0;
  };
}

type Props = { className?: string; pausado?: boolean; onStats?: (stats: PondStats) => void };

/** Lo que tarda el fundido al cambiar entre claro y oscuro (igual que el fondo de la app). */
const FUNDIDO_MS = 300;

export function Estanque({ className, pausado = false, onStats }: Props) {
  const { oscuro } = useTema();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PondEngine | null>(null);
  // En una ref, así un callback nuevo no rearma el estanque.
  const statsRef = useRef(onStats);
  statsRef.current = onStats;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PondEngine(canvas, (stats) => statsRef.current?.(stats));
    engine.setTheme(!document.documentElement.classList.contains('dark'));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Al cambiar de tema, los peces se desvanecen, cambian de colores y vuelven: sin el salto de golpe.
  const primero = useRef(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (primero.current || !canvas) {
      primero.current = false;
      engineRef.current?.setTheme(!oscuro);
      return;
    }
    canvas.style.opacity = '0';
    const t = setTimeout(() => {
      engineRef.current?.setTheme(!oscuro);
      canvas.style.opacity = '1';
    }, FUNDIDO_MS / 2);
    return () => clearTimeout(t);
  }, [oscuro]);

  useEffect(() => {
    engineRef.current?.setPaused(pausado);
  }, [pausado]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none transition-opacity ease-in-out', className)}
      style={{ transitionDuration: `${FUNDIDO_MS / 2}ms` }}
    />
  );
}

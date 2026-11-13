// Fondo "Aurora" de la sala de espera: cintas de luz con los colores de la marca que ondulan despacio.
// El mouse las empuja y un toque deja una onda que se va apagando.
import { useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';
import { useLienzo, type Escena } from './useLienzo';

interface Cinta {
  /** Color como "r g b". */
  color: string;
  /** Altura base, de 0 (arriba) a 1 (abajo). */
  base: number;
  /** Grosor, como parte del alto de la pantalla. */
  grosor: number;
  fase: number;
  ritmo: number;
}
interface Onda {
  x: number;
  edad: number;
}

const CINTAS: Cinta[] = [
  { color: '58 182 230', base: 0.16, grosor: 0.3, fase: 0, ritmo: 0.16 },
  { color: '43 182 115', base: 0.32, grosor: 0.28, fase: 2.1, ritmo: 0.12 },
  { color: '138 107 232', base: 0.5, grosor: 0.3, fase: 4.4, ritmo: 0.1 },
  { color: '245 183 0', base: 0.68, grosor: 0.2, fase: 1.2, ritmo: 0.14 },
];
/** Ancho de cada tira vertical, en px: más angosto es más suave pero más trabajo. */
const TIRA = 6;
const DURACION_ONDA = 3.2;

class EscenaAurora implements Escena {
  private tiempo = 0;
  private oscuro = true;
  private ondas: Onda[] = [];
  private puntero_ = { x: 0, fuerza: 0, destino: 0 };

  redimensionar() {}

  tema(oscuro: boolean) {
    this.oscuro = oscuro;
  }

  puntero(x: number, _y: number, activo: boolean) {
    if (activo) this.puntero_.x = x;
    this.puntero_.destino = activo ? 1 : 0;
  }

  toque(x: number) {
    this.ondas.push({ x, edad: 0 });
    if (this.ondas.length > 6) this.ondas.shift();
  }

  paso(dt: number) {
    this.tiempo += dt;
    const p = this.puntero_;
    p.fuerza += (p.destino - p.fuerza) * Math.min(1, dt * 4);
    for (const o of this.ondas) o.edad += dt;
    this.ondas = this.ondas.filter((o) => o.edad < DURACION_ONDA);
  }

  dibujar(ctx: CanvasRenderingContext2D, ancho: number, alto: number) {
    const t = this.tiempo;
    // Sobre fondo oscuro las luces se suman (brillan donde se cruzan); sobre claro se mezclan normal.
    ctx.globalCompositeOperation = this.oscuro ? 'lighter' : 'source-over';
    const intensidad = this.oscuro ? 0.62 : 0.5;
    const transformacion = ctx.getTransform();

    for (const c of CINTAS) {
      // Un degradado vertical de alto 1, que cada tira estira a su grosor: transparente, color, transparente.
      const luz = ctx.createLinearGradient(0, 0, 0, 1);
      luz.addColorStop(0, `rgb(${c.color} / 0)`);
      luz.addColorStop(0.22, `rgb(${c.color} / ${intensidad})`);
      luz.addColorStop(0.5, `rgb(${c.color} / ${intensidad * 0.35})`);
      luz.addColorStop(1, `rgb(${c.color} / 0)`);
      ctx.fillStyle = luz;
      const grosor = c.grosor * alto;

      for (let x = 0; x < ancho; x += TIRA) {
        const u = x / 420;
        let y =
          c.base * alto +
          Math.sin(u * 1.1 + t * c.ritmo * 2 + c.fase) * alto * 0.085 +
          Math.sin(u * 2.3 - t * c.ritmo * 3.1 + c.fase * 1.7) * alto * 0.03 +
          Math.sin(u * 0.45 + t * c.ritmo + c.fase * 0.6) * alto * 0.06;
        // El mouse levanta la cinta cerca suyo.
        const lejos = (x - this.puntero_.x) / 200;
        y -= Math.exp(-lejos * lejos) * 46 * this.puntero_.fuerza;
        // Las ondas de los toques viajan hacia los costados y se apagan.
        for (const o of this.ondas) {
          const d = Math.abs(x - o.x);
          const frente = d - o.edad * 520;
          y += Math.sin(frente / 46) * 30 * Math.exp(-(frente * frente) / 60000) * (1 - o.edad / DURACION_ONDA);
        }
        // Las "cortinas": el brillo cambia despacio a lo largo de la cinta, con un rayado fino encima.
        const cortina = 0.72 + 0.22 * Math.sin(x * 0.011 - t * 0.35 + c.fase) + 0.06 * Math.sin(x * 0.07 + t * 0.8 + c.fase * 3);
        ctx.globalAlpha = Math.max(0, Math.min(1, cortina));
        // Las tiras van pegadas, sin pisarse: si se pisan, al sumarse las luces queda una raya en cada unión.
        ctx.setTransform(transformacion.a, 0, 0, transformacion.d * grosor, transformacion.a * x, transformacion.d * (y - grosor * 0.22));
        ctx.fillRect(0, 0, TIRA, 1);
      }
    }
    ctx.setTransform(transformacion);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

type Props = { className?: string; pausado?: boolean };

export function Aurora({ className, pausado = false }: Props) {
  const { oscuro } = useTema();
  const ref = useLienzo(() => new EscenaAurora(), { oscuro, pausado });
  return <canvas ref={ref} aria-hidden="true" className={cn('pointer-events-none', className)} />;
}

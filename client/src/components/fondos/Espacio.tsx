// Fondo "Espacio" de la sala de espera: estrellas en tres capas que titilan y se corren con el mouse,
// un planeta con anillo y estrellas fugaces. Tocar el cielo lanza una fugaz hacia el dedo.
import { useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';
import { useLienzo, type Escena } from './useLienzo';

interface Estrella {
  x: number;
  y: number;
  capa: number;
  radio: number;
  fase: number;
  ritmo: number;
}
interface Fugaz {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  duracion: number;
}

/** Una estrella cada tantos px², con tope para las pantallas grandes. */
const AREA_POR_ESTRELLA = 3200;
const MAX_ESTRELLAS = 420;
/** Cuánto se corre cada capa con el mouse (las de adelante, más). */
const PARALAJE = [6, 14, 26];

class EscenaEspacio implements Escena {
  private estrellas: Estrella[] = [];
  private fugaces: Fugaz[] = [];
  private ancho = 1;
  private alto = 1;
  private tiempo = 0;
  private proxima = 2.5;
  private oscuro = true;
  // El corrimiento por el mouse, suavizado (de -1 a 1).
  private mira = { x: 0, y: 0, destinoX: 0, destinoY: 0 };

  redimensionar(ancho: number, alto: number) {
    this.ancho = ancho;
    this.alto = alto;
    const cantidad = Math.min(MAX_ESTRELLAS, Math.round((ancho * alto) / AREA_POR_ESTRELLA));
    // Las posiciones van de 0 a 1: al cambiar el tamaño se conservan las que ya había.
    while (this.estrellas.length < cantidad) {
      const capa = Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : 2;
      this.estrellas.push({
        x: Math.random(),
        y: Math.random(),
        capa,
        radio: 0.5 + capa * 0.45 + Math.random() * 0.5,
        fase: Math.random() * Math.PI * 2,
        ritmo: 0.6 + Math.random() * 1.8,
      });
    }
    this.estrellas.length = cantidad;
  }

  tema(oscuro: boolean) {
    this.oscuro = oscuro;
  }

  puntero(x: number, y: number, activo: boolean) {
    this.mira.destinoX = activo ? (x / this.ancho) * 2 - 1 : 0;
    this.mira.destinoY = activo ? (y / this.alto) * 2 - 1 : 0;
  }

  toque(x: number, y: number) {
    // Sale de arriba, desde el lado contrario, y pasa por donde se tocó.
    const desdeX = x < this.ancho / 2 ? x + this.alto * 0.7 : x - this.alto * 0.7;
    this.lanzar(desdeX, -20, x, y);
  }

  private lanzar(x: number, y: number, hastaX: number, hastaY: number) {
    const distancia = Math.hypot(hastaX - x, hastaY - y) || 1;
    const velocidad = Math.max(700, distancia * 1.6);
    this.fugaces.push({
      x,
      y,
      vx: ((hastaX - x) / distancia) * velocidad,
      vy: ((hastaY - y) / distancia) * velocidad,
      vida: 0,
      duracion: (distancia / velocidad) * 1.5,
    });
    if (this.fugaces.length > 12) this.fugaces.shift();
  }

  paso(dt: number) {
    this.tiempo += dt;
    const m = this.mira;
    m.x += (m.destinoX - m.x) * Math.min(1, dt * 3);
    m.y += (m.destinoY - m.y) * Math.min(1, dt * 3);
    // El cielo gira muy despacio: las capas de adelante, un poco más rápido.
    for (const e of this.estrellas) {
      e.x += dt * 0.0015 * (e.capa + 1);
      if (e.x > 1) e.x -= 1;
    }
    for (const f of this.fugaces) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vida += dt;
    }
    this.fugaces = this.fugaces.filter((f) => f.vida < f.duracion);
    this.proxima -= dt;
    if (this.proxima <= 0) {
      this.proxima = 3 + Math.random() * 5;
      const x = Math.random() * this.ancho;
      this.lanzar(x, -20, x + (Math.random() < 0.5 ? -1 : 1) * this.alto * (0.5 + Math.random() * 0.5), this.alto * (0.4 + Math.random() * 0.4));
    }
  }

  dibujar(ctx: CanvasRenderingContext2D, ancho: number, alto: number) {
    const { x: mx, y: my } = this.mira;

    // Estrellas: cuadraditos (más rápidos que círculos); las grandes llevan un resplandor.
    ctx.fillStyle = '#ffffff';
    for (const e of this.estrellas) {
      const brillo = 0.55 + 0.45 * Math.sin(this.tiempo * e.ritmo + e.fase);
      // De día (atardecer) se ven menos, y menos todavía cerca del horizonte.
      const cielo = this.oscuro ? 1 : 0.85 * (1 - e.y * 0.75);
      ctx.globalAlpha = Math.max(0, brillo * cielo);
      const x = e.x * ancho - mx * PARALAJE[e.capa]!;
      const y = e.y * alto - my * PARALAJE[e.capa]!;
      const lado = e.radio * 2;
      ctx.fillRect(x - e.radio, y - e.radio, lado, lado);
      if (e.capa === 2) {
        ctx.globalAlpha *= 0.25;
        ctx.fillRect(x - e.radio * 3, y - 0.5, lado * 3, 1);
        ctx.fillRect(x - 0.5, y - e.radio * 3, 1, lado * 3);
      }
    }
    ctx.globalAlpha = 1;

    this.planeta(ctx, ancho, alto, mx, my);

    // Estrellas fugaces: una línea que se desvanece hacia atrás.
    ctx.lineCap = 'round';
    for (const f of this.fugaces) {
      const avance = f.vida / f.duracion;
      const opacidad = Math.sin(Math.min(1, avance) * Math.PI);
      const velocidad = Math.hypot(f.vx, f.vy);
      const cola = 0.16;
      const colaX = f.x - (f.vx / velocidad) * velocidad * cola;
      const colaY = f.y - (f.vy / velocidad) * velocidad * cola;
      const trazo = ctx.createLinearGradient(f.x, f.y, colaX, colaY);
      trazo.addColorStop(0, `rgb(255 255 255 / ${opacidad})`);
      trazo.addColorStop(0.3, `rgb(160 220 255 / ${opacidad * 0.6})`);
      trazo.addColorStop(1, 'rgb(160 220 255 / 0)');
      ctx.strokeStyle = trazo;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(colaX, colaY);
      ctx.stroke();
    }
  }

  private planeta(ctx: CanvasRenderingContext2D, ancho: number, alto: number, mx: number, my: number) {
    const radio = Math.min(ancho, alto) * 0.085;
    // Arriba a la derecha, flotando apenas; se corre con el mouse como la capa más cercana.
    const x = ancho * 0.84 - mx * 34;
    const y = alto * 0.24 - my * 34 + Math.sin(this.tiempo * 0.4) * 6;
    const anillo = (frente: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.38);
      ctx.beginPath();
      // La mitad de atrás se dibuja antes del planeta y la de adelante, después.
      ctx.ellipse(0, 0, radio * 1.9, radio * 0.5, 0, frente ? 0 : Math.PI, frente ? Math.PI : Math.PI * 2);
      ctx.strokeStyle = this.oscuro ? 'rgb(170 215 245 / 0.75)' : 'rgb(255 225 190 / 0.85)';
      ctx.lineWidth = radio * 0.16;
      ctx.stroke();
      ctx.restore();
    };
    anillo(false);
    const cuerpo = ctx.createRadialGradient(x - radio * 0.4, y - radio * 0.45, radio * 0.1, x, y, radio);
    if (this.oscuro) {
      cuerpo.addColorStop(0, '#7fd4f5');
      cuerpo.addColorStop(0.55, '#2a8fc4');
      cuerpo.addColorStop(1, '#123a66');
    } else {
      cuerpo.addColorStop(0, '#ffd9a8');
      cuerpo.addColorStop(0.55, '#f08f6a');
      cuerpo.addColorStop(1, '#8a3f72');
    }
    ctx.fillStyle = cuerpo;
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.fill();
    anillo(true);
  }
}

type Props = { className?: string; pausado?: boolean };

export function Espacio({ className, pausado = false }: Props) {
  const { oscuro } = useTema();
  const ref = useLienzo(() => new EscenaEspacio(), { oscuro, pausado });
  return <canvas ref={ref} aria-hidden="true" className={cn('pointer-events-none', className)} />;
}

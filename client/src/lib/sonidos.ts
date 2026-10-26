// Sonidos sintetizados con Web Audio: no hay archivos que descargar y suenan igual sin internet.
// En /pantalla suena el juego; en /profe, solo el aviso suave de una mano levantada.
// El navegador exige un clic antes de reproducir audio.
import { CLAVES, guardar, leer } from './almacen';

let ctx: AudioContext | null = null;

export function sonidoActivado(): boolean {
  return leer(CLAVES.sonido) === '1';
}

/** Hay que llamarla desde un clic (requisito del navegador para habilitar el audio). */
export function activarSonido(activo: boolean): void {
  guardar(CLAVES.sonido, activo ? '1' : '0');
  if (activo) {
    ctx ??= new AudioContext();
    void ctx.resume();
  }
}

function nota(frecuencia: number, inicio: number, duracion: number, { tipo = 'sine' as OscillatorType, volumen = 0.18 } = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, t);
  gan.gain.setValueAtTime(0, t);
  gan.gain.linearRampToValueAtTime(volumen, t + 0.012);
  gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  osc.connect(gan).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracion + 0.05);
}

function preparado(activado = sonidoActivado()): boolean {
  if (!activado) return false;
  // Si la página se recargó, el contexto se crea recién con el primer sonido (puede quedar
  // suspendido hasta que alguien toque la pantalla).
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running';
}

export function avisoManosActivado(): boolean {
  return leer(CLAVES.sonidoManos) !== '0';
}

export function activarAvisoManos(activo: boolean): void {
  guardar(CLAVES.sonidoManos, activo ? '1' : '0');
  if (activo) {
    ctx ??= new AudioContext();
    void ctx.resume();
  }
}

/** En /profe: habilita el audio con el primer clic de la página (si se recargó, todavía no hubo). */
export function prepararAudioConPrimerClic(): () => void {
  const alClic = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
  };
  window.addEventListener('pointerdown', alClic, { once: true });
  window.addEventListener('keydown', alClic, { once: true });
  return () => {
    window.removeEventListener('pointerdown', alClic);
    window.removeEventListener('keydown', alClic);
  };
}

export const sonidos = {
  /** /profe: alguien levantó la mano. Dos notas suaves, que no interrumpen la clase. */
  mano() {
    if (!preparado(avisoManosActivado())) return;
    nota(880, 0, 0.35, { volumen: 0.08 });
    nota(1318.5, 0.1, 0.5, { volumen: 0.06 });
  },
  /** Alguien entró a la sala. */
  pop() {
    if (!preparado()) return;
    nota(660, 0, 0.12, { tipo: 'triangle', volumen: 0.12 });
    nota(990, 0.06, 0.14, { tipo: 'triangle', volumen: 0.1 });
  },
  /** Cada número de la cuenta regresiva. */
  cuenta(final = false) {
    if (!preparado()) return;
    nota(final ? 880 : 520, 0, final ? 0.4 : 0.18, { tipo: 'square', volumen: 0.07 });
  },
  /** Últimos segundos de la pregunta. */
  tic() {
    if (!preparado()) return;
    nota(1200, 0, 0.05, { tipo: 'square', volumen: 0.04 });
  },
  /** Cerró la pregunta. */
  gong() {
    if (!preparado()) return;
    nota(392, 0, 0.9, { volumen: 0.16 });
    nota(523.25, 0.08, 0.9, { volumen: 0.12 });
  },
  /** Aparece un puesto del podio. */
  redoble(i: number) {
    if (!preparado()) return;
    nota([392, 440, 523.25][i] ?? 523.25, 0, 0.35, { tipo: 'triangle', volumen: 0.14 });
  },
  /** El primer puesto. */
  fanfarria() {
    if (!preparado()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, i * 0.12, 0.5, { tipo: 'triangle', volumen: 0.14 }));
    nota(1046.5, 0.5, 1.2, { volumen: 0.12 });
  },
};

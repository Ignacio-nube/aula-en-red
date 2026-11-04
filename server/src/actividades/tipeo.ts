import {
  calcularPpm,
  calcularPrecision,
  LETRAS_POR_PALABRA,
  LIMITES_TIEMPO_TIPEO,
  PPM_MAXIMO,
  SEGUNDOS_CUENTA,
  textoFacil,
  type Ack,
  type AccionTipeo,
  type AlumnoConectado,
  type CorredorTipeo,
  type FaseTipeo,
  type OpcionesTipeo,
  type ProgresoTipeo,
  type RolSocket,
  type VistaTipeo,
} from '@aula/shared';
import { db } from '../db';
import { buscarTexto, mejoresMarcas } from '../db/tipeo';
import type { ContextoActividad, InstanciaActividad, ModuloActividad } from './tipos';

interface Corredor {
  alumnoId: number;
  nombre: string;
  avatar: string;
  posicion: number;
  errores: number;
  /** performance.now() en que arrancó (los que entran tarde arrancan cuando entran). */
  inicio: number;
  /** Cuánto tardó en terminar, si terminó. */
  tiempoMs: number | null;
}

const ahora = () => performance.now();
/** Letras por milisegundo a la velocidad máxima creíble, con un margen. */
const LETRAS_POR_MS = (PPM_MAXIMO * LETRAS_POR_PALABRA) / 60_000;

interface Config {
  textoId: number;
  titulo: string;
  texto: string;
  facil: boolean;
  limiteSeg: number | null;
}

function validarOpciones(o: OpcionesTipeo): Config | { error: string } {
  const t = buscarTexto(Number(o?.textoId));
  if (!t) return { error: 'Elegí un texto para la carrera.' };
  const limiteSeg = (LIMITES_TIEMPO_TIPEO as readonly (number | null)[]).includes(o.limiteSeg ?? null) ? (o.limiteSeg ?? null) : null;
  const facil = o.facil === true;
  return { textoId: t.id, titulo: t.titulo, texto: facil ? textoFacil(t.texto) : t.texto, facil, limiteSeg };
}

class CarreraTipeo implements InstanciaActividad<'tipeo'> {
  readonly tipo = 'tipeo';
  private fase: FaseTipeo = 'sala';
  private carreraId: number | null = null;
  private textoId = 0;
  private titulo = '';
  private texto = '';
  private facil = false;
  private limiteSeg: number | null = null;
  private readonly corredores = new Map<number, Corredor>();
  private marcas = new Map<number, number>();
  /** Momentos (performance.now) en que termina la cuenta, arranca y termina la carrera. */
  private finCuenta = 0;
  private inicio = 0;
  private fin = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ctx: ContextoActividad,
    config: Config,
  ) {
    this.configurar(config);
  }

  private configurar(config: Config): void {
    this.textoId = config.textoId;
    this.titulo = config.titulo;
    this.texto = config.texto;
    this.facil = config.facil;
    this.limiteSeg = config.limiteSeg;
    this.limpiarTimer();
    this.fase = 'sala';
    this.carreraId = null;
    this.marcas.clear();
    this.corredores.clear();
    for (const a of this.ctx.conectados()) this.sumar(a, ahora());
  }

  private sumar(a: AlumnoConectado, inicio: number): void {
    const c = this.corredores.get(a.id);
    if (c) {
      c.nombre = a.nombre;
      c.avatar = a.avatar;
      return;
    }
    this.corredores.set(a.id, { alumnoId: a.id, nombre: a.nombre, avatar: a.avatar, posicion: 0, errores: 0, inicio, tiempoMs: null });
  }

  private limpiarTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // --- flujo -------------------------------------------------------------------------

  accionProfe(accion: AccionTipeo): Ack {
    switch (accion?.tipo) {
      case 'empezar': {
        if (this.fase !== 'sala') return { ok: false, error: 'La carrera ya empezó.' };
        if (this.ctx.conectados().length === 0) return { ok: false, error: 'Todavía no entró nadie.' };
        this.fase = 'cuenta';
        this.finCuenta = ahora() + SEGUNDOS_CUENTA * 1000;
        this.timer = setTimeout(() => this.arrancar(), SEGUNDOS_CUENTA * 1000);
        this.ctx.avisar(true);
        return { ok: true };
      }
      case 'terminar':
        if (this.fase === 'cuenta') {
          this.limpiarTimer();
          this.fase = 'sala';
          this.ctx.avisar(true);
          return { ok: true };
        }
        if (this.fase !== 'carrera') return { ok: false, error: 'No hay ninguna carrera en curso.' };
        this.terminar();
        return { ok: true };
      case 'otraVuelta': {
        if (this.fase === 'cuenta' || this.fase === 'carrera') return { ok: false, error: 'Primero terminá la carrera.' };
        const config = validarOpciones(accion.opciones);
        if ('error' in config) return { ok: false, error: config.error };
        this.configurar(config);
        this.ctx.avisar(true);
        return { ok: true };
      }
      default:
        return { ok: false, error: 'Acción desconocida.' };
    }
  }

  private arrancar(): void {
    this.timer = null;
    this.fase = 'carrera';
    this.inicio = ahora();
    // Corren los que están ahora; los que entren después se suman desde que entran.
    for (const a of this.ctx.conectados()) this.sumar(a, this.inicio);
    for (const c of this.corredores.values()) Object.assign(c, { posicion: 0, errores: 0, inicio: this.inicio, tiempoMs: null });
    const { lastInsertRowid } = db
      .prepare('INSERT INTO tipeo_carreras (comision_id, comision_nombre, titulo, texto) VALUES (?, ?, ?, ?)')
      .run(this.ctx.comisionId, this.ctx.comisionNombre, this.titulo, this.texto);
    this.carreraId = Number(lastInsertRowid);
    this.marcas = mejoresMarcas([...this.corredores.keys()], this.carreraId);
    if (this.limiteSeg !== null) this.timer = setTimeout(() => this.terminar(), this.limiteSeg * 1000);
    this.ctx.avisar(true);
  }

  private terminar(): void {
    if (this.fase !== 'carrera') return;
    this.limpiarTimer();
    this.fase = 'fin';
    this.fin = ahora();
    const ins = db.prepare(
      `INSERT OR REPLACE INTO tipeo_resultados (carrera_id, alumno_id, ppm, precision, avance, completo, tiempo_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    db.transaction(() => {
      for (const c of this.corredores.values()) {
        const ms = this.msDe(c);
        ins.run(
          this.carreraId,
          c.alumnoId,
          calcularPpm(c.posicion, ms),
          calcularPrecision(c.posicion, c.errores),
          c.posicion / this.texto.length,
          c.tiempoMs !== null ? 1 : 0,
          Math.round(ms),
        );
      }
    })();
    this.ctx.avisar(true);
  }

  /** Si ya terminaron todos los que están conectados, no tiene sentido esperar. */
  private terminarSiTerminaronTodos(): void {
    if (this.fase !== 'carrera') return;
    const activos = [...this.corredores.values()].filter((c) => this.ctx.estaConectado(c.alumnoId));
    if (activos.length > 0 && activos.every((c) => c.tiempoMs !== null)) this.terminar();
  }

  enviarAlumno(alumnoId: number, envio: ProgresoTipeo): Ack {
    if (this.fase !== 'carrera') return { ok: false, error: 'La carrera no está en curso.' };
    const c = this.corredores.get(alumnoId);
    if (!c) return { ok: false, error: 'No estás en esta carrera.' };
    if (c.tiempoMs !== null) return { ok: true };
    const posicion = Math.floor(Number(envio?.posicion));
    const errores = Math.floor(Number(envio?.errores));
    if (!Number.isFinite(posicion) || !Number.isFinite(errores)) return { ok: false, error: 'Progreso inválido.' };

    // Nunca para atrás, nunca más allá del texto, ni más rápido de lo que alguien puede tipear.
    const transcurrido = ahora() - c.inicio;
    const maximo = Math.ceil(transcurrido * LETRAS_POR_MS) + 3;
    c.posicion = Math.max(c.posicion, Math.min(posicion, this.texto.length, maximo));
    c.errores = Math.max(c.errores, Math.min(errores, 100_000));
    if (c.posicion >= this.texto.length) {
      c.tiempoMs = transcurrido;
      this.ctx.avisar(true);
      this.terminarSiTerminaronTodos();
    } else this.ctx.avisar();
    return { ok: true };
  }

  alConectar(a: AlumnoConectado): void {
    if (this.fase === 'fin' && !this.corredores.has(a.id)) return;
    this.sumar(a, this.fase === 'carrera' ? ahora() : this.inicio);
    this.ctx.avisar();
  }

  alDesconectar(): void {
    this.terminarSiTerminaronTodos();
    this.ctx.avisar();
  }

  terminada(): boolean {
    return this.fase === 'fin';
  }

  destruir(): void {
    this.limpiarTimer();
  }

  // --- vistas ------------------------------------------------------------------------

  private msDe(c: Corredor): number {
    if (c.tiempoMs !== null) return c.tiempoMs;
    if (this.fase === 'carrera') return ahora() - c.inicio;
    if (this.fase === 'fin') return this.fin - c.inicio;
    return 0;
  }

  private ranking(): CorredorTipeo[] {
    const filas = [...this.corredores.values()]
      // En la sala solo se muestran los que están; en la carrera, también los que se fueron.
      .filter((c) => this.fase !== 'sala' || this.ctx.estaConectado(c.alumnoId))
      .sort(
        (a, b) =>
          (a.tiempoMs ?? Infinity) - (b.tiempoMs ?? Infinity) || b.posicion - a.posicion || a.errores - b.errores || a.nombre.localeCompare(b.nombre, 'es'),
      );
    return filas.map((c, i) => {
      const ms = this.msDe(c);
      return {
        alumnoId: c.alumnoId,
        nombre: c.nombre,
        avatar: c.avatar,
        posicion: c.posicion,
        ppm: calcularPpm(c.posicion, ms),
        precision: calcularPrecision(c.posicion, c.errores),
        terminado: c.tiempoMs !== null,
        tiempoMs: c.tiempoMs !== null ? Math.round(c.tiempoMs) : null,
        puesto: i + 1,
        conectado: this.ctx.estaConectado(c.alumnoId),
      };
    });
  }

  vista(rol: RolSocket, alumnoId?: number): VistaTipeo {
    const ranking = this.ranking();
    const t = ahora();
    const vista: VistaTipeo = {
      carreraId: this.carreraId,
      textoId: this.textoId,
      fase: this.fase,
      titulo: this.titulo,
      texto: this.texto,
      facil: this.facil,
      limiteSeg: this.limiteSeg,
      restanteMs:
        this.fase === 'cuenta'
          ? Math.max(0, Math.round(this.finCuenta - t))
          : this.fase === 'carrera' && this.limiteSeg !== null
            ? Math.max(0, Math.round(this.inicio + this.limiteSeg * 1000 - t))
            : null,
      transcurridoMs: this.fase === 'carrera' ? Math.round(t - this.inicio) : 0,
      corredores: rol === 'alumno' ? (this.fase === 'fin' ? ranking.slice(0, 3) : []) : ranking,
      participantes: ranking.length,
      terminaron: ranking.filter((r) => r.terminado).length,
    };
    if (rol === 'alumno' && alumnoId !== undefined) {
      const c = this.corredores.get(alumnoId);
      const fila = ranking.find((r) => r.alumnoId === alumnoId);
      vista.yo = {
        posicion: c?.posicion ?? 0,
        errores: c?.errores ?? 0,
        ppm: fila?.ppm ?? 0,
        precision: fila?.precision ?? 100,
        terminado: fila?.terminado ?? false,
        puesto: this.fase === 'carrera' || this.fase === 'fin' ? (fila?.puesto ?? null) : null,
        mejorAnterior: this.marcas.get(alumnoId) ?? null,
      };
      // Mientras corre, el alumno manda su propio inicio: le sirve saber desde cuándo cuenta.
      if (c && this.fase === 'carrera') vista.transcurridoMs = Math.round(t - c.inicio);
    }
    return vista;
  }
}

export const tipeo: ModuloActividad<'tipeo'> = {
  crear(ctx, opciones) {
    const config = validarOpciones(opciones);
    if ('error' in config) return config;
    return new CarreraTipeo(ctx, config);
  },
};

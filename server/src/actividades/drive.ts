import {
  esImagen,
  LIMITES_MISION,
  nombreComparable,
  textoPaso,
  type Ack,
  type AccionMisiones,
  type AlumnoConectado,
  type EventoDrive,
  type FilaMision,
  type OpcionesMisiones,
  type PasoMision,
  type RolSocket,
  type VistaMisiones,
} from '@aula/shared';
import { filasDe, type FilaItem } from '../db/drive';
import type { ContextoActividad, InstanciaActividad, ModuloActividad } from './tipos';

interface Participante {
  alumnoId: number;
  nombre: string;
  avatar: string;
  hechos: boolean[];
  /** Puesto en que completó todo. */
  puesto: number | null;
  /** Qué archivos o carpetas tocó durante las misiones, por tipo de cambio. */
  tocados: Map<EventoDrive, Set<number>>;
}

function limpiarNombre(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const n = valor.replace(/\s+/g, ' ').trim();
  return n.length > 0 && n.length <= LIMITES_MISION.nombre ? n : null;
}

function validarPaso(p: PasoMision): PasoMision | null {
  switch (p?.tipo) {
    case 'carpeta': {
      const nombre = limpiarNombre(p.nombre);
      return nombre ? { tipo: 'carpeta', nombre } : null;
    }
    case 'subir':
      return { tipo: 'subir', carpeta: p.carpeta ? limpiarNombre(p.carpeta) : null, soloImagen: p.soloImagen === true };
    case 'renombrar': {
      const nombre = limpiarNombre(p.nombre);
      return nombre ? { tipo: 'renombrar', nombre } : null;
    }
    case 'mover': {
      const carpeta = limpiarNombre(p.carpeta);
      return carpeta ? { tipo: 'mover', carpeta } : null;
    }
    case 'compartir':
      return { tipo: 'compartir', carpeta: p.carpeta ? limpiarNombre(p.carpeta) : null };
    case 'destacar':
    case 'papelera':
    case 'restaurar':
      return { tipo: p.tipo };
    default:
      return null;
  }
}

function validarOpciones(o: OpcionesMisiones): { titulo: string; pasos: PasoMision[] } | { error: string } {
  const titulo = limpiarNombre(o?.titulo)?.slice(0, LIMITES_MISION.titulo) || 'Misiones en Drive';
  if (!Array.isArray(o?.pasos) || o.pasos.length === 0) return { error: 'Agregá al menos una misión.' };
  if (o.pasos.length > LIMITES_MISION.pasos) return { error: `Pueden ser hasta ${LIMITES_MISION.pasos} misiones.` };
  const pasos: PasoMision[] = [];
  for (const p of o.pasos) {
    const v = validarPaso(p);
    if (!v) return { error: 'Hay una misión sin completar (le falta el nombre).' };
    pasos.push(v);
  }
  return { titulo, pasos };
}

/**
 * ¿Está cumplido el paso? Salvo la carpeta (si ya la tenía de otra clase, no hace falta que cree una repetida),
 * solo cuenta lo que el alumno hizo durante las misiones.
 */
function cumple(paso: PasoMision, filas: FilaItem[], tocados: Map<EventoDrive, Set<number>>): boolean {
  const vivas = filas.filter((f) => f.en_papelera_desde === null);
  const porId = new Map(filas.map((f) => [f.id, f]));
  const tocado = (evento: EventoDrive, f: FilaItem) => tocados.get(evento)?.has(f.id) ?? false;
  const igual = (a: string, b: string) => nombreComparable(a) === nombreComparable(b) || nombreComparable(a, true) === nombreComparable(b, true);
  const enCarpeta = (f: FilaItem, carpeta: string | null) => {
    if (carpeta === null) return true;
    const padre = f.padre_id !== null ? porId.get(f.padre_id) : undefined;
    return padre !== undefined && igual(padre.nombre, carpeta);
  };

  switch (paso.tipo) {
    case 'carpeta':
      return vivas.some((f) => f.tipo === 'carpeta' && igual(f.nombre, paso.nombre));
    case 'subir':
      return vivas.some((f) => f.tipo === 'archivo' && tocado('subir', f) && (!paso.soloImagen || esImagen(f.mime)) && enCarpeta(f, paso.carpeta));
    case 'renombrar':
      return vivas.some((f) => tocado('renombrar', f) && igual(f.nombre, paso.nombre));
    case 'mover':
      return vivas.some((f) => tocado('mover', f) && enCarpeta(f, paso.carpeta));
    case 'destacar':
      return (tocados.get('destacar')?.size ?? 0) > 0;
    case 'compartir':
      return vivas.some(
        (f) => f.tipo === 'archivo' && f.compartido === 1 && enCarpeta(f, paso.carpeta) && (tocado('compartir', f) || tocado('subir', f) || tocado('mover', f)),
      );
    case 'papelera':
      return (tocados.get('papelera')?.size ?? 0) > 0;
    case 'restaurar':
      return (tocados.get('restaurar')?.size ?? 0) > 0;
  }
}

interface MisionesGuardadas {
  titulo: string;
  pasos: PasoMision[];
  fase: 'curso' | 'fin';
  completaron: number;
  participantes: Omit<Participante, 'tocados'>[];
}

class Misiones implements InstanciaActividad<'drive'> {
  readonly tipo = 'drive';
  private fase: 'curso' | 'fin' = 'curso';
  private readonly participantes = new Map<number, Participante>();
  private completaron = 0;

  constructor(
    private readonly ctx: ContextoActividad,
    private readonly titulo: string,
    private readonly pasos: PasoMision[],
  ) {
    for (const a of ctx.conectados()) this.sumar(a);
  }

  /** Lo que se guarda para un reinicio: lo tildado de cada uno (qué tocaron se pierde, pero lo hecho queda). */
  guardar(): MisionesGuardadas {
    return {
      titulo: this.titulo,
      pasos: this.pasos,
      fase: this.fase,
      completaron: this.completaron,
      participantes: [...this.participantes.values()].map(({ alumnoId, nombre, avatar, hechos, puesto }) => ({ alumnoId, nombre, avatar, hechos, puesto })),
    };
  }

  static restaurar(ctx: ContextoActividad, datos: unknown): Misiones | null {
    const g = datos as MisionesGuardadas;
    const v = validarOpciones({ titulo: g?.titulo, pasos: g?.pasos });
    if ('error' in v) return null;
    const m = new Misiones(ctx, v.titulo, v.pasos);
    m.fase = g.fase === 'fin' ? 'fin' : 'curso';
    m.completaron = Number(g.completaron) || 0;
    for (const p of Array.isArray(g.participantes) ? g.participantes : []) {
      if (!Array.isArray(p?.hechos) || p.hechos.length !== v.pasos.length) continue;
      m.participantes.set(p.alumnoId, { ...p, hechos: p.hechos.map(Boolean), tocados: new Map() });
    }
    return m;
  }

  private sumar(a: AlumnoConectado): Participante {
    const p = this.participantes.get(a.id);
    if (p) {
      p.nombre = a.nombre;
      p.avatar = a.avatar;
      return p;
    }
    const nuevo: Participante = {
      alumnoId: a.id,
      nombre: a.nombre,
      avatar: a.avatar,
      hechos: this.pasos.map(() => false),
      puesto: null,
      tocados: new Map(),
    };
    this.participantes.set(a.id, nuevo);
    this.evaluar(nuevo);
    return nuevo;
  }

  /** Tilda lo que ya está cumplido. Lo hecho queda hecho: si después borra el archivo, la misión no se destilda. */
  private evaluar(p: Participante): boolean {
    const filas = filasDe(p.alumnoId);
    let cambio = false;
    this.pasos.forEach((paso, i) => {
      if (!p.hechos[i] && cumple(paso, filas, p.tocados)) {
        p.hechos[i] = true;
        cambio = true;
      }
    });
    if (cambio && p.puesto === null && p.hechos.every(Boolean)) p.puesto = ++this.completaron;
    return cambio;
  }

  accionProfe(accion: AccionMisiones): Ack {
    if (accion?.tipo === 'terminar') {
      this.fase = 'fin';
    } else if (accion?.tipo === 'reabrir') {
      this.fase = 'curso';
    } else return { ok: false, error: 'Acción desconocida.' };
    this.ctx.avisar(true);
    return { ok: true };
  }

  enviarAlumno(): Ack {
    return { ok: false, error: 'En esta actividad no hay nada para mandar.' };
  }

  alCambiarDrive(alumnoId: number, evento: EventoDrive | null, itemId: number | null): void {
    if (this.fase !== 'curso') return;
    const conectado = this.ctx.conectados().find((a) => a.id === alumnoId);
    const p = this.participantes.get(alumnoId) ?? (conectado ? this.sumar(conectado) : null);
    if (!p) return;
    if (evento && itemId !== null) {
      const set = p.tocados.get(evento) ?? new Set<number>();
      set.add(itemId);
      p.tocados.set(evento, set);
    } else if (evento) p.tocados.set(evento, p.tocados.get(evento) ?? new Set([0]));

    if (this.evaluar(p)) this.ctx.avisar(true);
  }

  alConectar(a: AlumnoConectado): void {
    if (this.fase === 'fin' && !this.participantes.has(a.id)) return;
    this.sumar(a);
    this.ctx.avisar();
  }

  alDesconectar(): void {
    this.ctx.avisar();
  }

  terminada(): boolean {
    return this.fase === 'fin';
  }

  destruir(): void {}

  private filas(): FilaMision[] {
    return [...this.participantes.values()]
      .filter((p) => this.ctx.estaConectado(p.alumnoId) || p.hechos.some(Boolean))
      .map((p) => ({
        alumnoId: p.alumnoId,
        nombre: p.nombre,
        avatar: p.avatar,
        hechos: [...p.hechos],
        puesto: p.puesto,
        conectado: this.ctx.estaConectado(p.alumnoId),
      }))
      .sort(
        (a, b) =>
          (a.puesto ?? Infinity) - (b.puesto ?? Infinity) ||
          b.hechos.filter(Boolean).length - a.hechos.filter(Boolean).length ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  }

  vista(rol: RolSocket, alumnoId?: number): VistaMisiones {
    const filas = this.filas();
    const vista: VistaMisiones = {
      titulo: this.titulo,
      pasos: this.pasos.map(textoPaso),
      fase: this.fase,
      alumnos: rol === 'alumno' ? [] : filas,
      participantes: filas.length,
      completaron: filas.filter((f) => f.puesto !== null).length,
    };
    if (rol === 'alumno' && alumnoId !== undefined) {
      const p = this.participantes.get(alumnoId);
      vista.yo = { hechos: p ? [...p.hechos] : this.pasos.map(() => false), puesto: p?.puesto ?? null };
    }
    return vista;
  }
}

export const misiones: ModuloActividad<'drive'> = {
  crear(ctx, opciones) {
    const v = validarOpciones(opciones);
    if ('error' in v) return v;
    return new Misiones(ctx, v.titulo, v.pasos);
  },
  restaurar: (ctx, datos) => Misiones.restaurar(ctx, datos),
};

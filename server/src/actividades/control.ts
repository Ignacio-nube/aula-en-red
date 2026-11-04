import {
  TIPOS_ACTIVIDAD,
  type Ack,
  type AccionActividad,
  type EventoDrive,
  type AlumnoConectado,
  type EstadoActividad,
  type MapaActividades,
  type RolSocket,
  type TipoActividad,
} from '@aula/shared';
import { db, guardarEstado, leerEstado } from '../db';
import { controlarEncuesta } from '../clase/encuesta';
import { presentacionActual } from '../clase/presentacion';
import { cerrarPartidaTerminada, hayJuegoEnCurso } from '../juego/control';
import { estaConectado, getIo, presenciaActual } from '../realtime';
import type { InstanciaActividad, ModuloActividad } from './tipos';
import { misiones } from './drive';
import { galeria } from './galeria';
import { tipeo } from './tipeo';

/** Para sumar una actividad: su módulo acá (y su entrada en MapaActividades y en el registro del cliente). */
const MODULOS: { [T in TipoActividad]: ModuloActividad<T> } = { tipeo, drive: misiones, galeria };

interface EnCurso {
  comisionId: number;
  comisionNombre: string;
  instancia: InstanciaActividad;
}

/** Una sola actividad a la vez, como el quiz y la presentación. */
let actual: EnCurso | null = null;

export function hayActividadEnCurso(): boolean {
  return actual !== null && !actual.instancia.terminada();
}

/** Si quedó una actividad terminada (mostrando resultados), la saca: por ejemplo, al empezar un quiz. */
export function cerrarActividadTerminada(): void {
  if (!actual || hayActividadEnCurso()) return;
  cerrar();
}

export function estadoActividadPara(rol: RolSocket, alumnoId?: number, comisionId?: number): EstadoActividad | null {
  if (!actual) return null;
  if (rol === 'alumno' && actual.comisionId !== comisionId) return null;
  return {
    tipo: actual.instancia.tipo,
    comisionId: actual.comisionId,
    comisionNombre: actual.comisionNombre,
    vista: seguro('vista', () => actual!.instancia.vista(rol, alumnoId), null),
  } as EstadoActividad;
}

function contexto(comisionId: number, comisionNombre: string) {
  return { comisionId, comisionNombre, avisar, estaConectado, conectados: () => presenciaActual()[comisionId] ?? [] };
}

interface Guardada {
  tipo: TipoActividad;
  comisionId: number;
  datos: unknown;
}

/** Guarda la actividad en curso (las que saben guardarse) para retomarla si se reinicia el servidor. */
let ultimoGuardado: string | null = null;

function persistir(): void {
  try {
    const datos = actual?.instancia.guardar?.();
    const valor = actual && datos !== undefined ? ({ tipo: actual.instancia.tipo, comisionId: actual.comisionId, datos } satisfies Guardada) : null;
    // Los avisos llegan hasta 5 veces por segundo: solo se escribe en la base si cambió algo.
    const texto = JSON.stringify(valor);
    if (texto === ultimoGuardado) return;
    ultimoGuardado = texto;
    guardarEstado('actividad', valor);
  } catch (err) {
    console.error('No se pudo guardar la actividad:', err);
  }
}

/** Al arrancar el servidor: retoma la actividad que estaba en curso, si se puede. */
export function restaurarActividad(): void {
  const g = leerEstado<Guardada>('actividad');
  if (!g) return;
  try {
    const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(g.comisionId);
    const modulo = MODULOS[g.tipo] as ModuloActividad | undefined;
    const instancia = comision && modulo?.restaurar ? modulo.restaurar(contexto(g.comisionId, comision.nombre), g.datos) : null;
    if (comision && instancia) {
      actual = { comisionId: g.comisionId, comisionNombre: comision.nombre, instancia };
      console.log(`  · Se retomó la actividad "${g.tipo}" que estaba en curso.`);
      return;
    }
  } catch (err) {
    console.error('No se pudo retomar la actividad:', err);
  }
  guardarEstado('actividad', null);
}

/** Lo que haga una actividad no puede tirar abajo el servidor: si algo falla, se avisa y sigue. */
function seguro<T>(que: string, fn: () => T, siFalla: T): T {
  try {
    return fn();
  } catch (err) {
    console.error(`Error en la actividad (${que}):`, err);
    return siFalla;
  }
}

const FALLA: Ack = { ok: false, error: 'Algo falló. Probá de nuevo.' };

// Los avisos se juntan: como mucho uno cada INTERVALO_MS, salvo los inmediatos (cambios de fase).
const INTERVALO_MS = 200;
let ultimoEnvio = 0;
let programado: NodeJS.Timeout | null = null;

function avisar(inmediato = false): void {
  if (programado && !inmediato) return;
  const espera = inmediato ? 0 : Math.max(0, ultimoEnvio + INTERVALO_MS - Date.now());
  if (programado) clearTimeout(programado);
  programado = setTimeout(emitir, espera);
}

function emitir(comisionAnterior?: number): void {
  programado = null;
  ultimoEnvio = Date.now();
  persistir();
  const io = getIo();
  if (!io) return;
  if (!actual) {
    io.to(['profe', 'pantalla']).emit('actividad:estado', null);
    if (comisionAnterior !== undefined) io.to(`comision:${comisionAnterior}`).emit('actividad:estado', null);
    return;
  }
  io.to('profe').emit('actividad:estado', estadoActividadPara('profe'));
  io.to('pantalla').emit('actividad:estado', estadoActividadPara('pantalla'));
  for (const id of io.sockets.adapter.rooms.get(`comision:${actual.comisionId}`) ?? []) {
    const s = io.sockets.sockets.get(id);
    if (s?.data.alumnoId !== undefined) s.emit('actividad:estado', estadoActividadPara('alumno', s.data.alumnoId, actual.comisionId));
  }
}

function cerrar(): void {
  if (!actual) return;
  const comision = actual.comisionId;
  actual.instancia.destruir();
  actual = null;
  if (programado) clearTimeout(programado);
  emitir(comision);
}

export function controlarActividad(accion: AccionActividad): Ack {
  if (accion.tipo === 'iniciar') {
    if (hayActividadEnCurso()) return { ok: false, error: 'Ya hay una actividad en curso. Terminala antes de empezar otra.' };
    if (hayJuegoEnCurso()) return { ok: false, error: 'Hay un quiz en curso. Terminalo antes de empezar otra actividad.' };
    if (presentacionActual()) return { ok: false, error: 'Hay una presentación en curso. Terminala antes de empezar otra actividad.' };
    if (!TIPOS_ACTIVIDAD.includes(accion.actividad)) return { ok: false, error: 'Esa actividad no existe.' };
    const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(Number(accion.comisionId));
    if (!comision) return { ok: false, error: 'Esa comisión no existe.' };

    const comisionId = Number(accion.comisionId);
    let creada: InstanciaActividad | { error: string };
    try {
      creada = (MODULOS[accion.actividad] as ModuloActividad).crear(
        contexto(comisionId, comision.nombre),
        accion.opciones as MapaActividades[TipoActividad]['opciones'],
      );
    } catch (err) {
      console.error('Error al empezar la actividad:', err);
      return { ok: false, error: 'No se pudo empezar la actividad. Probá de nuevo.' };
    }
    if ('error' in creada) return { ok: false, error: creada.error };

    cerrar();
    cerrarPartidaTerminada();
    // Como el quiz: si quedaba una encuesta en pantalla, la actividad la reemplaza (lo respondido queda guardado).
    controlarEncuesta({ tipo: 'quitar' });
    actual = { comisionId, comisionNombre: comision.nombre, instancia: creada };
    avisar(true);
    return { ok: true };
  }

  if (!actual) return { ok: false, error: 'No hay ninguna actividad en curso.' };
  if (accion.tipo === 'cerrar') {
    cerrar();
    return { ok: true };
  }
  const instancia = actual.instancia;
  return seguro('acción del profe', () => instancia.accionProfe(accion.accion), FALLA);
}

export function enviarActividad(alumnoId: number, comisionId: number, envio: unknown): Ack {
  if (!actual || actual.comisionId !== comisionId) return { ok: false, error: 'No hay ninguna actividad en curso.' };
  const instancia = actual.instancia;
  return seguro('envío del alumno', () => instancia.enviarAlumno(alumnoId, envio as MapaActividades[TipoActividad]['envio']), FALLA);
}

export function actividadAlConectar(a: AlumnoConectado): void {
  if (actual?.comisionId !== a.comisionId) return;
  const instancia = actual.instancia;
  seguro('al conectar', () => instancia.alConectar(a), undefined);
}

export function actividadAlDesconectar(alumnoId: number): void {
  const instancia = actual?.instancia;
  if (instancia) seguro('al desconectar', () => instancia.alDesconectar(alumnoId), undefined);
}

/** Avisa a la actividad en curso (si es de la comisión del alumno) que cambió algo en su Drive. */
export function actividadDriveCambio(alumnoId: number, comisionId: number, evento: EventoDrive | null, itemId: number | null): void {
  if (actual?.comisionId !== comisionId) return;
  const instancia = actual.instancia;
  seguro('cambio en el Drive', () => instancia.alCambiarDrive?.(alumnoId, evento, itemId), undefined);
}

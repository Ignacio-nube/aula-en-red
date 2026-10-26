import {
  DURACION_SENAL_MS,
  LIMITE_PREGUNTA_ANONIMA,
  type Ack,
  type AccionPreguntas,
  type Atencion,
  type ConteoSenales,
  type MisSenales,
  type PreguntaAnonima,
  type TipoSenal,
} from '@aula/shared';
import { getIo } from '../realtime';

// Todo esto vive en memoria: son cosas del momento de la clase, no historial.

// --- señales anónimas ("No entendí", "Más despacio") ---------------------------------

/** alumnoId → cuándo activó cada señal (Date.now()). */
const senales = new Map<number, Partial<Record<TipoSenal, number>>>();

function vigente(desde: number | undefined): boolean {
  return desde !== undefined && Date.now() - desde < DURACION_SENAL_MS;
}

export function conteoSenales(): ConteoSenales {
  let noEntendi = 0;
  let despacio = 0;
  for (const s of senales.values()) {
    if (vigente(s.noEntendi)) noEntendi++;
    if (vigente(s.despacio)) despacio++;
  }
  return { noEntendi, despacio };
}

export function misSenales(alumnoId: number): MisSenales {
  const s = senales.get(alumnoId) ?? {};
  return { noEntendi: vigente(s.noEntendi), despacio: vigente(s.despacio) };
}

let ultimoConteo = '';
function emitirSenales(alumnos: number[] = []): void {
  const io = getIo();
  if (!io) return;
  const conteo = conteoSenales();
  ultimoConteo = JSON.stringify(conteo);
  io.to('profe').emit('senales:actualizar', conteo);
  for (const id of alumnos) io.to(`alumno:${id}`).emit('senales:mias', misSenales(id));
}

export function cambiarSenal(alumnoId: number, tipo: TipoSenal, activa: boolean): Ack {
  if (tipo !== 'noEntendi' && tipo !== 'despacio') return { ok: false, error: 'Señal inválida.' };
  const s = senales.get(alumnoId) ?? {};
  if (activa) s[tipo] = Date.now();
  else delete s[tipo];
  senales.set(alumnoId, s);
  emitirSenales([alumnoId]);
  return { ok: true };
}

/** El profe ya lo explicó de nuevo (o bajó la velocidad): se ponen en cero. */
export function limpiarSenales(tipo: TipoSenal | null): Ack {
  const afectados: number[] = [];
  for (const [id, s] of senales) {
    if (tipo === null || tipo === 'noEntendi') delete s.noEntendi;
    if (tipo === null || tipo === 'despacio') delete s.despacio;
    afectados.push(id);
  }
  emitirSenales(afectados);
  return { ok: true };
}

// Las señales vencen solas: cada tanto se revisa y, si cambió el conteo, se avisa.
setInterval(() => {
  const vencidas: number[] = [];
  for (const [id, s] of senales) {
    for (const t of ['noEntendi', 'despacio'] as const) {
      if (s[t] !== undefined && !vigente(s[t])) {
        delete s[t];
        vencidas.push(id);
      }
    }
    if (s.noEntendi === undefined && s.despacio === undefined) senales.delete(id);
  }
  if (vencidas.length > 0 || JSON.stringify(conteoSenales()) !== ultimoConteo) emitirSenales(vencidas);
}, 5000).unref();

// --- preguntas anónimas ------------------------------------------------------------------

/** El autor se guarda solo para limitar cuántas manda; nunca sale del servidor. */
const preguntas: (PreguntaAnonima & { autor: number })[] = [];
let siguienteId = 1;
let destacada: string | null = null;
const ultimoEnvio = new Map<number, number>();
const ESPERA_ENTRE_PREGUNTAS_MS = 15_000;
const MAX_PENDIENTES_POR_ALUMNO = 5;

export function preguntasPendientes(): PreguntaAnonima[] {
  return preguntas.map(({ id, texto, desde }) => ({ id, texto, desde }));
}

export function preguntaDestacada(): string | null {
  return destacada;
}

function emitirPreguntas(): void {
  getIo()?.to('profe').emit('preguntas:actualizar', preguntasPendientes());
}

function emitirDestacada(): void {
  getIo()?.to(['profe', 'pantalla']).emit('pantalla:destacada', destacada);
}

export function enviarPregunta(alumnoId: number, texto: unknown): Ack {
  const limpio = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';
  if (limpio.length < 3) return { ok: false, error: 'Escribí tu pregunta.' };
  if (limpio.length > LIMITE_PREGUNTA_ANONIMA) return { ok: false, error: `Hasta ${LIMITE_PREGUNTA_ANONIMA} letras.` };
  const ultima = ultimoEnvio.get(alumnoId) ?? 0;
  if (Date.now() - ultima < ESPERA_ENTRE_PREGUNTAS_MS) return { ok: false, error: 'Esperá unos segundos antes de mandar otra.' };
  if (preguntas.filter((p) => p.autor === alumnoId).length >= MAX_PENDIENTES_POR_ALUMNO) {
    return { ok: false, error: 'Ya mandaste varias. Esperá a que el profe las vea.' };
  }
  ultimoEnvio.set(alumnoId, Date.now());
  preguntas.push({ id: siguienteId++, texto: limpio, desde: Date.now(), autor: alumnoId });
  emitirPreguntas();
  return { ok: true };
}

export function accionPreguntas(accion: AccionPreguntas): Ack {
  switch (accion.tipo) {
    case 'borrar': {
      const i = preguntas.findIndex((p) => p.id === accion.id);
      if (i >= 0) {
        if (destacada === preguntas[i]!.texto) destacada = null;
        preguntas.splice(i, 1);
      }
      break;
    }
    case 'destacar': {
      const p = preguntas.find((x) => x.id === accion.id);
      if (!p) return { ok: false, error: 'Esa pregunta ya no está.' };
      destacada = p.texto;
      break;
    }
    case 'quitarDestacada':
      destacada = null;
      break;
    case 'borrarTodas':
      preguntas.length = 0;
      destacada = null;
      break;
    default:
      return { ok: false, error: 'Acción inválida.' };
  }
  emitirPreguntas();
  emitirDestacada();
  return { ok: true };
}

// --- "Miren al frente" ------------------------------------------------------------------

let atencion: Atencion | null = null;

export function atencionPara(comisionId?: number): Atencion | null {
  if (!atencion) return null;
  if (comisionId !== undefined && atencion.comisionId !== null && atencion.comisionId !== comisionId) return null;
  return atencion;
}

export function cambiarAtencion(nueva: Atencion | null): Ack {
  const io = getIo();
  if (nueva !== null) {
    const mensaje = typeof nueva.mensaje === 'string' ? nueva.mensaje.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    const comisionId = Number.isInteger(nueva.comisionId) ? nueva.comisionId : null;
    atencion = { mensaje: mensaje || 'Miren al frente', comisionId };
  } else {
    atencion = null;
  }
  if (!io) return { ok: true };
  io.to('profe').emit('atencion:estado', atencion);
  // Cada alumno recibe su versión (a los de otra comisión no les llega).
  for (const s of io.sockets.sockets.values()) {
    if (s.data.rol === 'alumno') s.emit('atencion:estado', atencionPara(s.data.comisionId));
  }
  return { ok: true };
}

/** Al salir un alumno, sus señales dejan de contar. */
export function alSalirAlumno(alumnoId: number): void {
  if (senales.delete(alumnoId)) emitirSenales();
}

import {
  CARITAS_ESCALA,
  LIMITE_RESPUESTA_TEXTO,
  type Ack,
  type AccionEncuesta,
  type EncuestaEnVivo,
  type EncuestaGuardada,
  type RolSocket,
  type TipoEncuesta,
} from '@aula/shared';
import { db } from '../db';
import { hayJuegoEnCurso } from '../juego/control';
import { getIo, presenciaActual } from '../realtime';

interface Encuesta {
  id: number;
  comisionId: number;
  comisionNombre: string;
  pregunta: string;
  tipo: TipoEncuesta;
  opciones: string[];
  anonima: boolean;
  abierta: boolean;
  /** alumnoId → índice de opción o texto. Solo en memoria mientras dura (la base de las anónimas pierde el nombre al cerrar). */
  respuestas: Map<number, number | string>;
}

/** Una sola encuesta a la vez. */
let actual: Encuesta | null = null;

// Si el servidor se apagó con una encuesta abierta, queda cerrada (y las anónimas, sin nombres).
db.exec(`
  UPDATE encuesta_respuestas SET alumno_id = NULL
    WHERE encuesta_id IN (SELECT id FROM encuestas WHERE cerrada_en IS NULL AND anonima = 1);
  UPDATE encuestas SET cerrada_en = datetime('now') WHERE cerrada_en IS NULL;
`);

const guardarRespuesta = db.prepare(
  `INSERT INTO encuesta_respuestas (encuesta_id, alumno_id, valor) VALUES (?, ?, ?)
   ON CONFLICT (encuesta_id, alumno_id) DO UPDATE SET valor = excluded.valor`,
);

function textoLimpio(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function conteo(e: Encuesta): number[] {
  return e.opciones.map((_, i) => [...e.respuestas.values()].filter((v) => v === i).length);
}

export function encuestaPara(rol: RolSocket, alumnoId?: number, comisionId?: number): EncuestaEnVivo | null {
  const e = actual;
  if (!e) return null;
  if (rol === 'alumno' && e.comisionId !== comisionId) return null;
  const vista: EncuestaEnVivo = {
    id: e.id,
    comisionId: e.comisionId,
    comisionNombre: e.comisionNombre,
    pregunta: e.pregunta,
    tipo: e.tipo,
    opciones: e.opciones,
    anonima: e.anonima,
    abierta: e.abierta,
    respondieron: e.respuestas.size,
    conectados: presenciaActual()[e.comisionId]?.length ?? 0,
    // Mientras está abierta, solo el profe ve cómo va: así nadie vota "lo que vota la mayoría".
    resultados: e.tipo === 'texto' ? null : rol === 'profe' || !e.abierta ? conteo(e) : null,
  };
  if (rol === 'profe' && e.tipo === 'texto') {
    const nombres = new Map(
      db
        .prepare<[number], { id: number; nombre: string }>('SELECT id, nombre FROM alumnos WHERE comision_id = ?')
        .all(e.comisionId)
        .map((a) => [a.id, a.nombre]),
    );
    vista.textos = [...e.respuestas].map(([id, v]) => ({ texto: String(v), ...(e.anonima ? {} : { nombre: nombres.get(id) ?? '' }) }));
  }
  if (rol === 'alumno' && alumnoId !== undefined) vista.miRespuesta = e.respuestas.get(alumnoId) ?? null;
  return vista;
}

// Varios votos en el mismo tick salen en un solo envío.
let pendiente = false;
export function emitirEncuesta(comisionAnterior?: number): void {
  if (pendiente) return;
  pendiente = true;
  queueMicrotask(() => {
    pendiente = false;
    const io = getIo();
    if (!io) return;
    io.to('profe').emit('encuesta:estado', encuestaPara('profe'));
    io.to('pantalla').emit('encuesta:estado', encuestaPara('pantalla'));
    const comision = actual?.comisionId ?? comisionAnterior;
    if (comision === undefined) return;
    for (const id of io.sockets.adapter.rooms.get(`comision:${comision}`) ?? []) {
      const s = io.sockets.sockets.get(id);
      if (s?.data.alumnoId !== undefined) s.emit('encuesta:estado', encuestaPara('alumno', s.data.alumnoId, s.data.comisionId));
    }
  });
}

function cerrar(e: Encuesta): void {
  if (!e.abierta) return;
  e.abierta = false;
  db.transaction(() => {
    db.prepare("UPDATE encuestas SET cerrada_en = datetime('now') WHERE id = ?").run(e.id);
    if (e.anonima) db.prepare('UPDATE encuesta_respuestas SET alumno_id = NULL WHERE encuesta_id = ?').run(e.id);
  })();
}

export function controlarEncuesta(accion: AccionEncuesta): Ack {
  switch (accion.tipo) {
    case 'iniciar': {
      if (actual?.abierta) return { ok: false, error: 'Ya hay una encuesta abierta. Cerrala antes de empezar otra.' };
      if (hayJuegoEnCurso()) return { ok: false, error: 'Hay un quiz en curso. Esperá a que termine.' };
      const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(Number(accion.comisionId));
      if (!comision) return { ok: false, error: 'Elegí una comisión.' };
      const pregunta = textoLimpio(accion.pregunta, 200);
      if (pregunta.length < 3) return { ok: false, error: 'Escribí la pregunta de la encuesta.' };
      const tipo: TipoEncuesta = accion.tipoEncuesta === 'escala' || accion.tipoEncuesta === 'texto' ? accion.tipoEncuesta : 'opciones';
      let opciones: string[] = [];
      if (tipo === 'escala') opciones = [...CARITAS_ESCALA];
      if (tipo === 'opciones') {
        opciones = (Array.isArray(accion.opciones) ? accion.opciones : []).map((o) => textoLimpio(o, 60)).filter(Boolean).slice(0, 6);
        if (opciones.length < 2) return { ok: false, error: 'Poné al menos 2 opciones.' };
      }
      const anonima = accion.anonima !== false;
      const { lastInsertRowid } = db
        .prepare('INSERT INTO encuestas (comision_id, comision_nombre, pregunta, tipo, opciones_json, anonima) VALUES (?, ?, ?, ?, ?, ?)')
        .run(Number(accion.comisionId), comision.nombre, pregunta, tipo, JSON.stringify(opciones), anonima ? 1 : 0);
      const anterior = actual?.comisionId;
      actual = {
        id: Number(lastInsertRowid),
        comisionId: Number(accion.comisionId),
        comisionNombre: comision.nombre,
        pregunta,
        tipo,
        opciones,
        anonima,
        abierta: true,
        respuestas: new Map(),
      };
      if (anterior !== undefined && anterior !== actual.comisionId) emitirSinEncuesta(anterior);
      emitirEncuesta();
      return { ok: true };
    }
    case 'cerrar':
      if (!actual) return { ok: false, error: 'No hay ninguna encuesta.' };
      cerrar(actual);
      emitirEncuesta();
      return { ok: true };
    case 'quitar': {
      if (!actual) return { ok: true };
      cerrar(actual);
      const comision = actual.comisionId;
      actual = null;
      emitirEncuesta(comision);
      return { ok: true };
    }
    default:
      return { ok: false, error: 'Acción inválida.' };
  }
}

function emitirSinEncuesta(comisionId: number): void {
  getIo()?.to(`comision:${comisionId}`).emit('encuesta:estado', null);
}

export function responderEncuesta(alumnoId: number, comisionId: number, valor: unknown): Ack {
  const e = actual;
  if (!e || e.comisionId !== comisionId) return { ok: false, error: 'No hay ninguna encuesta.' };
  if (!e.abierta) return { ok: false, error: 'La encuesta ya se cerró.' };
  let v: number | string;
  if (e.tipo === 'texto') {
    v = textoLimpio(valor, LIMITE_RESPUESTA_TEXTO);
    if (v.length === 0) return { ok: false, error: 'Escribí tu respuesta.' };
  } else {
    v = Number(valor);
    if (!Number.isInteger(v) || v < 0 || v >= e.opciones.length) return { ok: false, error: 'Elegí una opción.' };
  }
  e.respuestas.set(alumnoId, v);
  guardarRespuesta.run(e.id, alumnoId, String(v));
  emitirEncuesta();
  return { ok: true };
}

/** Para Resultados: encuestas ya hechas, con sus respuestas. */
export function encuestasGuardadas(): EncuestaGuardada[] {
  const filas = db
    .prepare<[], { id: number; comision_nombre: string; pregunta: string; tipo: TipoEncuesta; opciones_json: string; anonima: number; creada_en: string }>(
      'SELECT id, comision_nombre, pregunta, tipo, opciones_json, anonima, creada_en FROM encuestas ORDER BY creada_en DESC, id DESC',
    )
    .all();
  const stmt = db.prepare<[number], { valor: string; nombre: string | null }>(
    'SELECT r.valor, a.nombre FROM encuesta_respuestas r LEFT JOIN alumnos a ON a.id = r.alumno_id WHERE r.encuesta_id = ? ORDER BY r.id',
  );
  return filas.map((f) => {
    const opciones = JSON.parse(f.opciones_json) as string[];
    const respuestas = stmt.all(f.id);
    const anonima = f.anonima === 1;
    return {
      id: f.id,
      comisionNombre: f.comision_nombre,
      pregunta: f.pregunta,
      tipo: f.tipo,
      opciones,
      anonima,
      creadaEn: f.creada_en,
      respondieron: respuestas.length,
      resultados: opciones.map((_, i) => respuestas.filter((r) => r.valor === String(i)).length),
      textos: f.tipo === 'texto' ? respuestas.map((r) => ({ texto: r.valor, ...(anonima || !r.nombre ? {} : { nombre: r.nombre }) })) : [],
    };
  });
}

export function encuestaActualId(): number | null {
  return actual?.id ?? null;
}

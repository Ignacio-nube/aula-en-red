import {
  bonusPorRacha,
  esRespuestaCorrecta,
  EXTENSION_MS,
  mezclar,
  puntaje,
  SEGUNDOS_CUENTA,
  type Ack,
  type EstadoJuego,
  type FaseJuego,
  type FilaRanking,
  type ModoRanking,
  type PreguntaQuiz,
  type Quiz,
  type RespuestaJuego,
  type RolSocket,
} from '@aula/shared';
import { db } from '../db';

interface Participante {
  alumnoId: number;
  nombre: string;
  avatar: string;
  puntos: number;
  racha: number;
  aciertos: number;
  delta: number;
}

interface RespuestaActual {
  /** Las opciones elegidas: una sola en multiple/vf; las marcadas en varias; el orden en ordenar. */
  eleccion: number[];
  correcta: boolean;
  /** Puntos de la pregunta, ya con el bonus incluido. */
  puntos: number;
  bonus: number;
}

/** Margen para respuestas que salieron a tiempo pero tardaron en llegar por la red. */
const GRACIA_MS = 300;

const insRespuesta = db.prepare(
  `INSERT OR IGNORE INTO respuestas (sesion_id, pregunta_id, alumno_id, opcion_id, correcta, tiempo_ms, puntos, respuesta_json)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insParticipante = db.prepare('INSERT OR IGNORE INTO sesion_alumnos (sesion_id, alumno_id) VALUES (?, ?)');

const ahora = () => performance.now();

/**
 * Un quiz en vivo. El servidor es la autoridad del estado y del tiempo: los clientes reciben
 * cuánto falta (en ms) y animan solos; las respuestas se validan con este reloj.
 * Todo lo que importa se guarda en SQLite en el momento, para sobrevivir a un reinicio.
 */
export class Partida {
  fase: FaseJuego = 'lobby';
  indice = -1;
  modoRanking: ModoRanking;
  readonly participantes = new Map<number, Participante>();
  readonly salteadas = new Set<number>();
  private respuestas = new Map<number, RespuestaActual>();
  private totalMs = 0;
  private finEn = 0;
  private pausadoRestante: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    readonly sesionId: number,
    readonly comisionId: number,
    readonly comisionNombre: string,
    readonly quiz: Quiz,
    readonly bonusRacha: boolean,
    modoRanking: ModoRanking,
    /** Avisa que cambió algo, para mandar el estado a todos. */
    private readonly avisar: () => void,
    /** Quién de la comisión está conectado ahora. */
    private readonly estaConectado: (alumnoId: number) => boolean,
  ) {
    this.modoRanking = modoRanking;
  }

  get pregunta(): PreguntaQuiz | null {
    return this.quiz.preguntas[this.indice] ?? null;
  }

  // --- participantes -------------------------------------------------------------

  agregarParticipante(a: { id: number; nombre: string; avatar: string }): void {
    const p = this.participantes.get(a.id);
    if (p) {
      // Pudo haber cambiado el nombre o el avatar desde el panel.
      p.nombre = a.nombre;
      p.avatar = a.avatar;
      return;
    }
    this.participantes.set(a.id, { alumnoId: a.id, nombre: a.nombre, avatar: a.avatar, puntos: 0, racha: 0, aciertos: 0, delta: 0 });
    insParticipante.run(this.sesionId, a.id);
  }

  quitarParticipante(alumnoId: number): void {
    this.participantes.delete(alumnoId);
    this.respuestas.delete(alumnoId);
  }

  private conectados(): Participante[] {
    return [...this.participantes.values()].filter((p) => this.estaConectado(p.alumnoId));
  }

  // --- tiempo ------------------------------------------------------------------------

  restanteMs(): number {
    if (this.fase !== 'pregunta') return 0;
    return this.pausadoRestante ?? Math.max(0, this.finEn - ahora());
  }

  private programar(ms: number, fn: () => void): void {
    this.limpiarTimer();
    this.timer = setTimeout(fn, Math.max(0, ms));
  }

  private limpiarTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // --- flujo -------------------------------------------------------------------------

  siguiente(): Ack {
    switch (this.fase) {
      case 'lobby':
        if (this.quiz.preguntas.length === 0) return { ok: false, error: 'El quiz no tiene preguntas.' };
        this.cuenta(this.indice + 1);
        return { ok: true };
      case 'cuenta':
        this.iniciarPregunta();
        return { ok: true };
      case 'pregunta':
        this.cerrarPregunta();
        return { ok: true };
      case 'resultado':
        this.fase = 'ranking';
        this.avisar();
        return { ok: true };
      case 'ranking':
        if (this.indice + 1 < this.quiz.preguntas.length) this.cuenta(this.indice + 1);
        else this.podio();
        return { ok: true };
      case 'podio':
        return { ok: false, error: 'El quiz ya terminó.' };
    }
  }

  private cuenta(i: number): void {
    this.indice = i;
    this.fase = 'cuenta';
    this.respuestas.clear();
    this.programar(SEGUNDOS_CUENTA * 1000, () => this.iniciarPregunta());
    this.avisar();
  }

  private iniciarPregunta(): void {
    const p = this.pregunta;
    if (!p) return;
    this.fase = 'pregunta';
    this.totalMs = p.tiempoSeg * 1000;
    this.finEn = ahora() + this.totalMs;
    this.pausadoRestante = null;
    this.programar(this.totalMs + GRACIA_MS, () => this.cerrarPregunta());
    this.avisar();
  }

  responder(alumnoId: number, respuesta: RespuestaJuego): Ack {
    const p = this.pregunta;
    if (this.fase !== 'pregunta' || !p) return { ok: false, error: 'Se terminó el tiempo de esta pregunta.' };
    const participante = this.participantes.get(alumnoId);
    if (!participante) return { ok: false, error: 'No estás anotado en este quiz.' };
    if (this.respuestas.has(alumnoId)) return { ok: false, error: 'Ya respondiste esta pregunta.' };

    const ids = new Set(p.opciones.map((o) => o.id));
    const eleccion = (Array.isArray(respuesta) ? respuesta : [respuesta]).map(Number);
    const multiple = p.tipo === 'varias' || p.tipo === 'ordenar';
    // Una respuesta que llegó tarde, cuando ya se estaba en otra pregunta.
    if (eleccion.length === 0 || eleccion.some((id) => !ids.has(id)) || new Set(eleccion).size !== eleccion.length) {
      return { ok: false, error: 'Esa respuesta era de una pregunta que ya se terminó el tiempo.' };
    }
    if (!multiple && eleccion.length !== 1) return { ok: false, error: 'Elegí una sola opción.' };
    if (p.tipo === 'ordenar' && eleccion.length !== p.opciones.length) return { ok: false, error: 'Faltan pasos por ordenar.' };

    const restante = this.restanteMs();
    if (restante <= 0 && this.pausadoRestante === null && ahora() > this.finEn + GRACIA_MS) {
      return { ok: false, error: 'Se terminó el tiempo de esta pregunta.' };
    }
    const tiempoMs = Math.round(Math.min(this.totalMs, Math.max(0, this.totalMs - restante)));
    const correcta = esRespuestaCorrecta(p, multiple ? eleccion : eleccion[0]!);
    const base = correcta ? puntaje(tiempoMs, this.totalMs, p.multiplicador) : 0;
    const bonus = correcta && p.multiplicador > 0 && this.bonusRacha ? bonusPorRacha(participante.racha + 1) : 0;

    const json = multiple ? JSON.stringify(eleccion) : null;
    const { changes } = insRespuesta.run(this.sesionId, p.id, alumnoId, eleccion[0], correcta ? 1 : 0, tiempoMs, base + bonus, json);
    if (changes === 0) return { ok: false, error: 'Ya respondiste esta pregunta.' };
    this.respuestas.set(alumnoId, { eleccion, correcta, puntos: base + bonus, bonus });

    if (!this.cerrarSiRespondieronTodos()) this.avisar();
    return { ok: true };
  }

  /** Si ya respondieron todos los conectados, cierra antes de tiempo. */
  cerrarSiRespondieronTodos(): boolean {
    if (this.fase !== 'pregunta') return false;
    const conectados = this.conectados();
    if (conectados.length > 0 && conectados.every((p) => this.respuestas.has(p.alumnoId))) {
      this.cerrarPregunta();
      return true;
    }
    return false;
  }

  private cerrarPregunta(): void {
    const p = this.pregunta;
    if (this.fase !== 'pregunta' || !p) return;
    this.limpiarTimer();
    this.fase = 'resultado';
    db.transaction(() => {
      for (const part of this.participantes.values()) {
        const r = this.respuestas.get(part.alumnoId);
        if (!r) insRespuesta.run(this.sesionId, p.id, part.alumnoId, null, 0, this.totalMs, 0, null);
        aplicarResultado(part, r);
      }
      db.prepare('UPDATE sesiones SET ultima_cerrada = ? WHERE id = ?').run(this.indice, this.sesionId);
    })();
    this.avisar();
  }

  saltar(): Ack {
    const p = this.pregunta;
    if ((this.fase !== 'cuenta' && this.fase !== 'pregunta') || !p) {
      return { ok: false, error: 'Solo se puede saltar la pregunta que está en curso.' };
    }
    this.limpiarTimer();
    this.respuestas.clear();
    this.salteadas.add(this.indice);
    db.transaction(() => {
      db.prepare('DELETE FROM respuestas WHERE sesion_id = ? AND pregunta_id = ?').run(this.sesionId, p.id);
      db.prepare('UPDATE sesiones SET ultima_cerrada = ? WHERE id = ?').run(this.indice, this.sesionId);
    })();
    if (this.indice + 1 < this.quiz.preguntas.length) this.cuenta(this.indice + 1);
    else this.podio();
    return { ok: true };
  }

  pausar(): Ack {
    if (this.fase !== 'pregunta') return { ok: false, error: 'Solo se puede pausar durante una pregunta.' };
    if (this.pausadoRestante !== null) return { ok: true };
    this.pausadoRestante = this.restanteMs();
    this.limpiarTimer();
    this.avisar();
    return { ok: true };
  }

  reanudar(): Ack {
    if (this.fase !== 'pregunta' || this.pausadoRestante === null) return { ok: true };
    this.finEn = ahora() + this.pausadoRestante;
    this.programar(this.pausadoRestante + GRACIA_MS, () => this.cerrarPregunta());
    this.pausadoRestante = null;
    this.avisar();
    return { ok: true };
  }

  extender(): Ack {
    if (this.fase !== 'pregunta') return { ok: false, error: 'Solo se puede sumar tiempo durante una pregunta.' };
    this.totalMs += EXTENSION_MS;
    if (this.pausadoRestante !== null) {
      this.pausadoRestante += EXTENSION_MS;
    } else {
      this.finEn += EXTENSION_MS;
      this.programar(this.finEn - ahora() + GRACIA_MS, () => this.cerrarPregunta());
    }
    this.avisar();
    return { ok: true };
  }

  /** Termina ya: si hay una pregunta en curso la cierra (cuentan las respuestas dadas) y va al podio. */
  terminar(): Ack {
    if (this.fase === 'podio') return { ok: true };
    if (this.fase === 'pregunta') {
      this.cerrarPregunta();
    } else if (this.fase === 'cuenta') {
      // Todavía no se mostró: queda como no jugada.
      this.limpiarTimer();
      this.indice -= 1;
    }
    this.podio();
    return { ok: true };
  }

  private podio(): void {
    this.limpiarTimer();
    this.fase = 'podio';
    db.prepare("UPDATE sesiones SET estado = 'finalizada', finalizada_en = datetime('now') WHERE id = ?").run(this.sesionId);
    this.avisar();
  }

  cambiarModoRanking(modo: ModoRanking): void {
    this.modoRanking = modo;
    this.avisar();
  }

  destruir(): void {
    this.limpiarTimer();
  }

  // --- vistas ------------------------------------------------------------------------

  ranking(): FilaRanking[] {
    const filas = [...this.participantes.values()].sort(
      (a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.nombre.localeCompare(b.nombre, 'es'),
    );
    let puesto = 0;
    return filas.map((p, i) => {
      if (i === 0 || filas[i - 1]!.puntos !== p.puntos) puesto = i + 1;
      return {
        alumnoId: p.alumnoId,
        nombre: p.nombre,
        avatar: p.avatar,
        puntos: p.puntos,
        puesto,
        aciertos: p.aciertos,
        racha: p.racha,
        delta: p.delta,
        conectado: this.estaConectado(p.alumnoId),
      };
    });
  }

  vista(rol: RolSocket, alumnoId?: number): EstadoJuego {
    const p = this.pregunta;
    const cerrada = this.fase === 'resultado' || this.fase === 'ranking' || this.fase === 'podio';
    const mostrarPregunta = p && this.fase !== 'lobby' && this.fase !== 'cuenta';
    const verCorrecta = rol === 'profe' || cerrada;

    // En "ordenar" los pasos se muestran mezclados (siempre igual para la misma sesión y pregunta).
    const opciones = p ? (p.tipo === 'ordenar' ? mezclar(p.opciones, this.sesionId * 7919 + p.id) : p.opciones) : [];

    let distribucion: number[] | null = null;
    let correctas: number | null = null;
    if (p && (rol === 'profe' || cerrada) && this.fase !== 'cuenta' && !this.salteadas.has(this.indice)) {
      const rs = [...this.respuestas.values()];
      distribucion =
        p.tipo === 'ordenar'
          ? opciones.map((o) => rs.filter((r) => r.eleccion[p.opciones.findIndex((x) => x.id === o.id)] === o.id).length)
          : opciones.map((o) => rs.filter((r) => r.eleccion.includes(o.id)).length);
      correctas = rs.filter((r) => r.correcta).length;
    }

    const ranking = this.ranking();
    let rankingVista: FilaRanking[];
    if (rol === 'profe') rankingVista = ranking;
    else if (rol === 'pantalla') {
      rankingVista = this.fase === 'podio' || this.modoRanking === 'top3' ? ranking.filter((r) => r.puesto <= 3) : ranking;
      // En la sala de espera la pantalla muestra a todos los que entraron.
      if (this.fase === 'lobby') rankingVista = ranking;
    } else rankingVista = this.fase === 'podio' ? ranking.filter((r) => r.puesto <= 3) : [];

    const estado: EstadoJuego = {
      sesionId: this.sesionId,
      quizTitulo: this.quiz.titulo,
      comisionId: this.comisionId,
      comisionNombre: this.comisionNombre,
      fase: this.fase,
      indice: this.indice,
      total: this.quiz.preguntas.length,
      pregunta:
        mostrarPregunta || (rol === 'profe' && p)
          ? {
              id: p.id,
              tipo: p.tipo,
              texto: p.texto,
              imagen: p.imagen,
              multiplicador: p.multiplicador,
              opciones: opciones.map((o) => ({ id: o.id, texto: o.texto, ...(verCorrecta ? { correcta: o.esCorrecta } : {}) })),
              ...(p.tipo === 'ordenar' && verCorrecta ? { ordenCorrecto: p.opciones.map((o) => o.id) } : {}),
            }
          : null,
      tiempoTotalMs: this.fase === 'pregunta' ? this.totalMs : (p?.tiempoSeg ?? 0) * 1000,
      restanteMs: Math.round(this.restanteMs()),
      pausado: this.pausadoRestante !== null,
      respondieron: this.respuestas.size,
      conectados: this.conectados().length,
      distribucion,
      correctas,
      ranking: rankingVista,
      modoRanking: this.modoRanking,
      bonusRacha: this.bonusRacha,
      salteadas: [...this.salteadas],
    };

    if (rol === 'profe') estado.quienesRespondieron = [...this.respuestas.keys()];

    if (rol === 'alumno' && alumnoId !== undefined) {
      const yo = this.participantes.get(alumnoId);
      const r = this.respuestas.get(alumnoId);
      const fila = ranking.find((f) => f.alumnoId === alumnoId);
      estado.yo = {
        respondio: !!r,
        opcionId: r && p && p.tipo !== 'varias' && p.tipo !== 'ordenar' ? r.eleccion[0]! : null,
        ...(r && p && (p.tipo === 'varias' || p.tipo === 'ordenar') ? { opcionIds: r.eleccion } : {}),
        racha: yo?.racha ?? 0,
        puntos: yo?.puntos ?? 0,
        puesto: fila?.puesto ?? null,
        ...(cerrada && this.fase !== 'podio' && !this.salteadas.has(this.indice)
          ? { correcta: r?.correcta ?? false, puntosPregunta: r?.puntos ?? 0, bonus: r?.bonus ?? 0 }
          : {}),
      };
    }
    return estado;
  }

  // --- retomar después de un reinicio ----------------------------------------------

  /** Reconstruye una partida desde la base: puntos, rachas y preguntas salteadas. */
  static desdeBase(sesionId: number, opciones: { avisar: () => void; estaConectado: (id: number) => boolean; modoRanking: ModoRanking }): Partida | null {
    const s = db
      .prepare<[number], { comision_id: number; quiz_json: string; ultima_cerrada: number; bonus_racha: number; estado: string }>(
        'SELECT comision_id, quiz_json, ultima_cerrada, bonus_racha, estado FROM sesiones WHERE id = ?',
      )
      .get(sesionId);
    if (!s || s.estado !== 'activa') return null;
    const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(s.comision_id);
    if (!comision) return null;

    const quiz = JSON.parse(s.quiz_json) as Quiz;
    const partida = new Partida(sesionId, s.comision_id, comision.nombre, quiz, s.bonus_racha === 1, opciones.modoRanking, opciones.avisar, opciones.estaConectado);

    // Lo respondido en una pregunta que quedó a medias se descarta: esa pregunta se vuelve a hacer.
    const enCurso = quiz.preguntas.slice(s.ultima_cerrada + 1).map((p) => p.id);
    for (const id of enCurso) db.prepare('DELETE FROM respuestas WHERE sesion_id = ? AND pregunta_id = ?').run(sesionId, id);

    const alumnos = db
      .prepare<[number], { id: number; nombre: string; avatar: string }>(
        'SELECT a.id, a.nombre, a.avatar FROM sesion_alumnos sa JOIN alumnos a ON a.id = sa.alumno_id WHERE sa.sesion_id = ?',
      )
      .all(sesionId);
    for (const a of alumnos) partida.agregarParticipante(a);

    const stmt = db.prepare<[number, number], { alumno_id: number; opcion_id: number | null; correcta: number; puntos: number }>(
      'SELECT alumno_id, opcion_id, correcta, puntos FROM respuestas WHERE sesion_id = ? AND pregunta_id = ?',
    );
    quiz.preguntas.slice(0, s.ultima_cerrada + 1).forEach((p, i) => {
      const filas = stmt.all(sesionId, p.id);
      if (filas.length === 0) {
        partida.salteadas.add(i);
        return;
      }
      for (const part of partida.participantes.values()) {
        const f = filas.find((x) => x.alumno_id === part.alumnoId);
        aplicarResultado(part, f && f.opcion_id !== null ? { eleccion: [f.opcion_id], correcta: f.correcta === 1, puntos: f.puntos, bonus: 0 } : undefined);
      }
    });

    partida.indice = s.ultima_cerrada;
    partida.fase = s.ultima_cerrada >= 0 ? 'ranking' : 'lobby';
    return partida;
  }
}

function aplicarResultado(p: Participante, r: RespuestaActual | undefined): void {
  if (r?.correcta) {
    p.racha += 1;
    p.aciertos += 1;
    p.puntos += r.puntos;
    p.delta = r.puntos;
  } else {
    p.racha = 0;
    p.delta = 0;
  }
}

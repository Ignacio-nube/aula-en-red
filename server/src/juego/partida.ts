import {
  bonusPorRacha,
  calcularPpm,
  calcularPrecision,
  esRespuestaCorrecta,
  LETRAS_POR_PALABRA,
  PPM_MAXIMO,
  puntajeTipeo,
  promedioEquipo,
  EXTENSION_MS,
  mezclar,
  puntaje,
  SEGUNDOS_CUENTA,
  type Ack,
  type CorredorTipeo,
  type EstadoJuego,
  type FaseJuego,
  type FilaEquipo,
  type FilaRanking,
  type ModoRanking,
  type PreguntaQuiz,
  type ProgresoTipeo,
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
  /** Índice del equipo, o null si se juega de a uno. */
  equipo: number | null;
}

interface RespuestaActual {
  /** Las opciones elegidas: una sola en multiple/vf; las marcadas en varias; el orden en ordenar. */
  eleccion: number[];
  correcta: boolean;
  /** Puntos de la pregunta, ya con el bonus incluido. */
  puntos: number;
  bonus: number;
}

/** Avance de un alumno en una pregunta de carrera de tipeo. */
interface Corredor {
  posicion: number;
  errores: number;
  /** Cuánto tardó en terminar (en el reloj de la pregunta), si terminó. */
  tiempoMs: number | null;
}

/** Margen para respuestas que salieron a tiempo pero tardaron en llegar por la red. */
const GRACIA_MS = 300;
/** Letras por milisegundo a la velocidad máxima creíble (más rápido que eso, se recorta). */
const LETRAS_POR_MS = (PPM_MAXIMO * LETRAS_POR_PALABRA) / 60_000;

const insRespuesta = db.prepare(
  `INSERT OR IGNORE INTO respuestas (sesion_id, pregunta_id, alumno_id, opcion_id, correcta, tiempo_ms, puntos, respuesta_json)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insParticipante = db.prepare('INSERT OR IGNORE INTO sesion_alumnos (sesion_id, alumno_id, equipo) VALUES (?, ?, ?)');
const updEquipo = db.prepare('UPDATE sesion_alumnos SET equipo = ? WHERE sesion_id = ? AND alumno_id = ?');

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
  /** Carrera de tipeo: lo que lleva cada uno en la pregunta actual. */
  private corredores = new Map<number, Corredor>();
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
    /** Cantidad de equipos, o null para jugar de a uno. */
    readonly cantidadEquipos: number | null = null,
  ) {
    this.modoRanking = modoRanking;
  }

  get pregunta(): PreguntaQuiz | null {
    return this.quiz.preguntas[this.indice] ?? null;
  }

  // --- participantes -------------------------------------------------------------

  /** `equipo` solo al retomar desde la base; si no, va al equipo con menos gente. */
  agregarParticipante(a: { id: number; nombre: string; avatar: string }, equipo?: number | null): void {
    const p = this.participantes.get(a.id);
    if (p) {
      // Pudo haber cambiado el nombre o el avatar desde el panel.
      p.nombre = a.nombre;
      p.avatar = a.avatar;
      return;
    }
    const e = this.cantidadEquipos === null ? null : (equipo ?? this.equipoConMenosGente());
    this.participantes.set(a.id, { alumnoId: a.id, nombre: a.nombre, avatar: a.avatar, puntos: 0, racha: 0, aciertos: 0, delta: 0, equipo: e });
    insParticipante.run(this.sesionId, a.id, e);
  }

  // --- equipos -----------------------------------------------------------------------

  private equipoConMenosGente(): number {
    const n = this.cantidadEquipos ?? 1;
    const conteo = Array.from({ length: n }, () => 0);
    for (const p of this.participantes.values()) if (p.equipo !== null && p.equipo < n) conteo[p.equipo]!++;
    const minimo = Math.min(...conteo);
    // Entre los empatados, uno al azar: si no, el primero siempre se llena antes.
    const candidatos = conteo.flatMap((c, i) => (c === minimo ? [i] : []));
    return candidatos[Math.floor(Math.random() * candidatos.length)]!;
  }

  /** Rearma los equipos al azar y parejos (solo en la sala de espera). */
  mezclarEquipos(): Ack {
    if (this.cantidadEquipos === null) return { ok: false, error: 'Este quiz se juega de a uno.' };
    if (this.fase !== 'lobby') return { ok: false, error: 'Los equipos se arman antes de empezar.' };
    const n = this.cantidadEquipos;
    // Primero los conectados, para que queden parejos entre los que de verdad juegan.
    const todos = [...this.participantes.values()];
    const orden = [...todos.filter((p) => this.estaConectado(p.alumnoId)), ...todos.filter((p) => !this.estaConectado(p.alumnoId))];
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j]!, orden[i]!];
    }
    const desde = Math.floor(Math.random() * n);
    db.transaction(() => {
      orden.forEach((p, i) => {
        p.equipo = (desde + i) % n;
        updEquipo.run(p.equipo, this.sesionId, p.alumnoId);
      });
    })();
    this.avisar();
    return { ok: true };
  }

  moverEquipo(alumnoId: number, equipo: number): Ack {
    if (this.cantidadEquipos === null) return { ok: false, error: 'Este quiz se juega de a uno.' };
    if (this.fase !== 'lobby') return { ok: false, error: 'Los equipos se arman antes de empezar.' };
    const p = this.participantes.get(alumnoId);
    if (!p) return { ok: false, error: 'Ese alumno no está en el quiz.' };
    if (!Number.isInteger(equipo) || equipo < 0 || equipo >= this.cantidadEquipos) return { ok: false, error: 'Ese equipo no existe.' };
    p.equipo = equipo;
    updEquipo.run(equipo, this.sesionId, alumnoId);
    this.avisar();
    return { ok: true };
  }

  rankingEquipos(): FilaEquipo[] | null {
    if (this.cantidadEquipos === null) return null;
    const todos = [...this.participantes.values()];
    const filas = Array.from({ length: this.cantidadEquipos }, (_, equipo) => {
      const miembros = todos.filter((p) => p.equipo === equipo);
      const puntos = promedioEquipo(miembros.map((m) => m.puntos));
      return { equipo, puntos, delta: puntos - promedioEquipo(miembros.map((m) => m.puntos - m.delta)), puesto: 0, integrantes: miembros.length };
    }).sort((a, b) => b.puntos - a.puntos || a.equipo - b.equipo);
    filas.forEach((f, i) => (f.puesto = i === 0 || filas[i - 1]!.puntos !== f.puntos ? i + 1 : filas[i - 1]!.puesto));
    return filas;
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
    this.corredores.clear();
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
    if (p.tipo === 'tipeo') return { ok: false, error: 'En esta pregunta se responde tipeando.' };
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

  /** Tiempo jugado de la pregunta actual (sin contar las pausas). */
  private transcurridoMs(): number {
    return Math.min(this.totalMs, Math.max(0, this.totalMs - this.restanteMs()));
  }

  /**
   * Carrera de tipeo: el alumno manda hasta dónde llegó y cuántas teclas erró. Nunca para atrás, nunca
   * más allá del texto ni más rápido de lo creíble. Al llegar al final queda como respuesta correcta.
   * `termino` dice si llegó (hay que avisar a todos) o solo avanzó (alcanza con la pantalla y el profe).
   */
  progresoTipeo(alumnoId: number, envio: ProgresoTipeo): Ack & { termino?: boolean } {
    const p = this.pregunta;
    if (this.fase !== 'pregunta' || !p || p.tipo !== 'tipeo') return { ok: false, error: 'No hay ninguna carrera de tipeo en curso.' };
    if (this.pausadoRestante !== null) return { ok: false, error: 'El quiz está en pausa.' };
    const participante = this.participantes.get(alumnoId);
    if (!participante) return { ok: false, error: 'No estás anotado en este quiz.' };
    const posicion = Math.floor(Number(envio?.posicion));
    const errores = Math.floor(Number(envio?.errores));
    if (!Number.isFinite(posicion) || !Number.isFinite(errores)) return { ok: false, error: 'Progreso inválido.' };

    const c = this.corredores.get(alumnoId) ?? { posicion: 0, errores: 0, tiempoMs: null };
    this.corredores.set(alumnoId, c);
    if (c.tiempoMs !== null) return { ok: true };
    const transcurrido = this.transcurridoMs();
    const maximo = Math.ceil((transcurrido + GRACIA_MS) * LETRAS_POR_MS) + 3;
    c.posicion = Math.max(c.posicion, Math.min(posicion, p.texto.length, maximo));
    c.errores = Math.max(c.errores, Math.min(errores, 100_000));
    if (c.posicion < p.texto.length) return { ok: true, termino: false };

    c.tiempoMs = Math.round(transcurrido);
    const precision = calcularPrecision(c.posicion, c.errores);
    const base = puntajeTipeo({ terminado: true, tiempoMs: c.tiempoMs, totalMs: this.totalMs, avance: 1, precision, multiplicador: p.multiplicador });
    const bonus = p.multiplicador > 0 && this.bonusRacha ? bonusPorRacha(participante.racha + 1) : 0;
    insRespuesta.run(this.sesionId, p.id, alumnoId, 0, 1, c.tiempoMs, base + bonus, this.jsonTipeo(c));
    this.respuestas.set(alumnoId, { eleccion: [], correcta: true, puntos: base + bonus, bonus });
    if (!this.cerrarSiRespondieronTodos()) this.avisar();
    return { ok: true, termino: true };
  }

  private jsonTipeo(c: Corredor): string {
    const ms = c.tiempoMs ?? this.transcurridoMs();
    return JSON.stringify({ posicion: c.posicion, errores: c.errores, ppm: calcularPpm(c.posicion, ms), precision: calcularPrecision(c.posicion, c.errores) });
  }

  /** Los corredores de la carrera de tipeo: primero los que llegaron (por tiempo), después por avance. */
  private carrera(): CorredorTipeo[] {
    const p = this.pregunta;
    if (!p || p.tipo !== 'tipeo') return [];
    const ms = this.fase === 'pregunta' ? this.transcurridoMs() : this.totalMs;
    const filas = [...this.participantes.values()]
      .map((part) => ({ part, c: this.corredores.get(part.alumnoId) ?? { posicion: 0, errores: 0, tiempoMs: null } }))
      .sort(
        (a, b) =>
          (a.c.tiempoMs ?? Infinity) - (b.c.tiempoMs ?? Infinity) ||
          b.c.posicion - a.c.posicion ||
          a.c.errores - b.c.errores ||
          a.part.nombre.localeCompare(b.part.nombre, 'es'),
      );
    return filas.map(({ part, c }, i) => ({
      alumnoId: part.alumnoId,
      nombre: part.nombre,
      avatar: part.avatar,
      posicion: c.posicion,
      ppm: calcularPpm(c.posicion, c.tiempoMs ?? ms),
      precision: calcularPrecision(c.posicion, c.errores),
      terminado: c.tiempoMs !== null,
      tiempoMs: c.tiempoMs,
      puesto: i + 1,
      conectado: this.estaConectado(part.alumnoId),
    }));
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
        let r = this.respuestas.get(part.alumnoId);
        const c = p.tipo === 'tipeo' ? this.corredores.get(part.alumnoId) : undefined;
        if (!r && c && c.posicion > 0) {
          // Carrera de tipeo sin terminar: suma por lo que avanzó, pero no cuenta como acierto.
          const puntos = puntajeTipeo({
            terminado: false,
            tiempoMs: this.totalMs,
            totalMs: this.totalMs,
            avance: c.posicion / p.texto.length,
            precision: calcularPrecision(c.posicion, c.errores),
            multiplicador: p.multiplicador,
          });
          insRespuesta.run(this.sesionId, p.id, part.alumnoId, 0, 0, this.totalMs, puntos, this.jsonTipeo(c));
          r = { eleccion: [], correcta: false, puntos, bonus: 0 };
          this.respuestas.set(part.alumnoId, r);
        } else if (!r) insRespuesta.run(this.sesionId, p.id, part.alumnoId, null, 0, this.totalMs, 0, null);
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
    this.corredores.clear();
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
    const filas = [...this.participantes.values()].sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.nombre.localeCompare(b.nombre, 'es'));
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
        equipo: p.equipo,
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
      if (p.tipo === 'tipeo') distribucion = null;
    }
    const enCarrera = p?.tipo === 'tipeo' && (this.fase === 'pregunta' || this.fase === 'resultado') && !this.salteadas.has(this.indice);
    const carrera = enCarrera ? this.carrera() : null;

    const ranking = this.ranking();
    const equipos = this.rankingEquipos();
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
      equipos,
      // El alumno no ve la carrera mientras corre (solo su texto); al cerrar, el top 3.
      carrera: carrera && (rol !== 'alumno' ? carrera : this.fase === 'resultado' ? carrera.filter((c) => c.posicion > 0).slice(0, 3) : []),
      transcurridoMs: this.fase === 'pregunta' ? Math.round(this.transcurridoMs()) : 0,
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
        ...(yo && yo.equipo !== null ? { equipo: yo.equipo, puestoEquipo: equipos?.find((e) => e.equipo === yo.equipo)?.puesto } : {}),
        ...(carrera ? { tipeo: miTipeo(carrera, this.corredores.get(alumnoId), alumnoId) } : {}),
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
      .prepare<[number], { comision_id: number; quiz_json: string; ultima_cerrada: number; bonus_racha: number; estado: string; equipos: number | null }>(
        'SELECT comision_id, quiz_json, ultima_cerrada, bonus_racha, estado, equipos FROM sesiones WHERE id = ?',
      )
      .get(sesionId);
    if (!s || s.estado !== 'activa') return null;
    const comision = db.prepare<[number], { nombre: string }>('SELECT nombre FROM comisiones WHERE id = ?').get(s.comision_id);
    if (!comision) return null;

    const quiz = JSON.parse(s.quiz_json) as Quiz;
    const partida = new Partida(
      sesionId,
      s.comision_id,
      comision.nombre,
      quiz,
      s.bonus_racha === 1,
      opciones.modoRanking,
      opciones.avisar,
      opciones.estaConectado,
      s.equipos,
    );

    // Lo respondido en una pregunta que quedó a medias se descarta: esa pregunta se vuelve a hacer.
    const enCurso = quiz.preguntas.slice(s.ultima_cerrada + 1).map((p) => p.id);
    for (const id of enCurso) db.prepare('DELETE FROM respuestas WHERE sesion_id = ? AND pregunta_id = ?').run(sesionId, id);

    const alumnos = db
      .prepare<[number], { id: number; nombre: string; avatar: string; equipo: number | null }>(
        'SELECT a.id, a.nombre, a.avatar, sa.equipo FROM sesion_alumnos sa JOIN alumnos a ON a.id = sa.alumno_id WHERE sa.sesion_id = ?',
      )
      .all(sesionId);
    for (const a of alumnos) partida.agregarParticipante(a, a.equipo);

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
    // Una incorrecta suma 0, salvo la carrera de tipeo sin terminar (puntos por lo que avanzó).
    p.racha = 0;
    p.puntos += r?.puntos ?? 0;
    p.delta = r?.puntos ?? 0;
  }
}

function miTipeo(carrera: CorredorTipeo[], c: Corredor | undefined, alumnoId: number): NonNullable<EstadoJuego['yo']>['tipeo'] {
  const fila = carrera.find((f) => f.alumnoId === alumnoId);
  return {
    posicion: c?.posicion ?? 0,
    errores: c?.errores ?? 0,
    ppm: fila?.ppm ?? 0,
    precision: fila?.precision ?? 100,
    terminado: c?.tiempoMs != null,
    puesto: c && c.posicion > 0 ? (fila?.puesto ?? null) : null,
  };
}

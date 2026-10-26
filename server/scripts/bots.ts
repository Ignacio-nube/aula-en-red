// Simulador de alumnos: conecta N alumnos falsos que responden al azar con demoras aleatorias.
//
//   npm run bots -- 8                         8 bots en la comisión "Bots"
//   npm run bots -- 8 --comision "Martes 14 h"
//   npm run bots -- 8 --caos                  además, cada tanto un bot "recarga la página"
//   npm run bots -- 8 --manos                 además, cada tanto un bot levanta o baja la mano, avisa
//                                             "No entendí" / "Más despacio" o manda una pregunta anónima
//   npm run bots -- 8 --url http://192.168.0.15:3000 --pin 4821
//
// Los bots se crean solos (Bot 1, Bot 2, …) en esa comisión, con su contraseña. Después, desde
// /profe → Clase en vivo, se inicia un quiz para esa comisión y los bots juegan. Durante una
// presentación, los bots siguen las diapositivas (y lo informan en la consola).
import { io, type Socket } from 'socket.io-client';
import {
  AVATARES,
  type ClientToServerEvents,
  type EncuestaEnVivo,
  type EstadoJuego,
  type RespuestaJuego,
  type ServerToClientEvents,
} from '@aula/shared';
import { PIN_PROFE, PUERTO } from '../src/config';

type SocketBot = Socket<ServerToClientEvents, ClientToServerEvents>;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const CANTIDAD = Math.max(1, Math.min(60, Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 8)));
const URL_SERVIDOR = argumento('url') ?? `http://localhost:${PUERTO}`;
const PIN = argumento('pin') ?? PIN_PROFE;
const COMISION = argumento('comision') ?? 'Bots';
const CAOS = process.argv.includes('--caos');
const MANOS = process.argv.includes('--manos');
// No puede contener "bot": el medidor la rechazaría por contener el nombre.
const PASSWORD = 'Galaxia#Clave2025';
/** Probabilidad de que un bot no llegue a responder. */
const PROB_NO_RESPONDE = 0.1;

async function api<T>(ruta: string, opciones: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opciones.token) headers.Authorization = `Bearer ${opciones.token}`;
  const res = await fetch(`${URL_SERVIDOR}/api${ruta}`, {
    method: opciones.method ?? 'GET',
    headers,
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
  const datos = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(datos?.error ?? `HTTP ${res.status}`), { status: res.status });
  return datos;
}

interface Bot {
  id: number;
  nombre: string;
  token: string;
  socket?: SocketBot;
  respondidas: Set<string>;
  /** Pregunta en curso según el último estado recibido ("sesión:índice"), o null. */
  enCurso: string | null;
  manoArriba?: boolean;
  encuestas: Set<number>;
}

const log = (...m: unknown[]) => console.log(new Date().toLocaleTimeString('es-AR'), ...m);
const stats = {
  respuestas: 0,
  rechazadas: 0,
  errores: [] as string[],
  error(m: string) {
    this.errores.push(m);
    log('  ✘', m);
  },
};

async function prepararBots(tokenProfe: string): Promise<Bot[]> {
  const comisiones = await api<{ id: number; nombre: string }[]>('/comisiones');
  let comision = comisiones.find((c) => c.nombre.toLowerCase() === COMISION.toLowerCase());
  if (!comision) {
    comision = await api('/comisiones', { method: 'POST', token: tokenProfe, body: { nombre: COMISION } });
    log(`Creé la comisión "${COMISION}"`);
  }
  let alumnos = await api<{ id: number; nombre: string; tienePassword: boolean }[]>(`/comisiones/${comision!.id}/alumnos`);
  for (let i = 1; i <= CANTIDAD; i++) {
    const nombre = `Bot ${i}`;
    if (!alumnos.some((a) => a.nombre === nombre)) {
      await api(`/comisiones/${comision!.id}/alumnos`, {
        method: 'POST',
        token: tokenProfe,
        body: { nombre, avatar: AVATARES[(i - 1) % AVATARES.length] },
      });
    }
  }
  alumnos = await api(`/comisiones/${comision!.id}/alumnos`);

  const bots: Bot[] = [];
  for (let i = 1; i <= CANTIDAD; i++) {
    const a = alumnos.find((x) => x.nombre === `Bot ${i}`)!;
    let token: string;
    try {
      if (!a.tienePassword) throw Object.assign(new Error('sin contraseña'), { status: 409 });
      ({ token } = await api<{ token: string }>('/alumno/login', { method: 'POST', body: { alumnoId: a.id, password: PASSWORD } }));
    } catch {
      // No tiene contraseña o tiene otra: se restaura y se crea la de los bots.
      if (a.tienePassword) await api(`/alumnos/${a.id}/restaurar`, { method: 'POST', token: tokenProfe });
      ({ token } = await api<{ token: string }>('/alumno/crear-password', { method: 'POST', body: { alumnoId: a.id, password: PASSWORD } }));
    }
    bots.push({ id: a.id, nombre: a.nombre, token, respondidas: new Set(), enCurso: null, encuestas: new Set() });
  }
  return bots;
}

let ultimoLog = '';
function conectar(bot: Bot): void {
  const socket: SocketBot = io(URL_SERVIDOR, { auth: { rol: 'alumno', token: bot.token }, transports: ['websocket'], forceNew: true });
  bot.socket = socket;
  socket.on('connect_error', (e) => stats.error(`${bot.nombre}: ${e.message}`));
  socket.on('sesion:expirada', () => log(`${bot.nombre}: el profe le cerró la sesión`));
  socket.on('juego:estado', (e) => alEstado(bot, e));
  socket.on('encuesta:estado', (e) => alEncuesta(bot, e));
  socket.on('mano:estado', (m) => {
    bot.manoArriba = m.arriba;
  });
  socket.on('presentacion:estado', (p) => {
    if (bot.id !== bots[0]?.id) return;
    const linea = p ? `"${p.titulo}": diapositiva ${p.pagina}/${p.paginas}${p.libre ? ' (modo libre)' : ''}` : 'sin presentación';
    if (linea !== ultimaDiapo) log(`Presentación ${(ultimaDiapo = linea)}`);
  });
}
let ultimaDiapo = '';

function alEstado(bot: Bot, e: EstadoJuego | null): void {
  bot.enCurso = e?.fase === 'pregunta' ? `${e.sesionId}:${e.indice}` : null;
  if (!e) return;
  if (bot.id === bots[0]?.id) {
    const linea = `${e.fase} ${e.indice + 1}/${e.total}`;
    if (linea !== ultimoLog) {
      ultimoLog = linea;
      if (e.fase === 'pregunta') log(`Pregunta ${e.indice + 1}/${e.total}: "${e.pregunta?.texto}"`);
      if (e.fase === 'resultado') log(`  cerró: ${e.respondieron}/${e.conectados} respondieron`);
      if (e.fase === 'podio') log(`Podio. Respuestas enviadas: ${stats.respuestas}, rechazadas: ${stats.rechazadas}`);
    }
  }
  if (e.fase !== 'pregunta' || !e.pregunta || e.yo?.respondio || e.pausado) return;
  const clave = `${e.sesionId}:${e.indice}`;
  if (bot.respondidas.has(clave)) return;
  bot.respondidas.add(clave);
  if (Math.random() < PROB_NO_RESPONDE) return;

  const ids = e.pregunta.opciones.map((o) => o.id);
  let respuesta: RespuestaJuego;
  if (e.pregunta.tipo === 'ordenar') respuesta = [...ids].sort(() => Math.random() - 0.5);
  else if (e.pregunta.tipo === 'varias') {
    const marcadas = ids.filter(() => Math.random() < 0.5);
    respuesta = marcadas.length > 0 ? marcadas : [ids[0]!];
  } else respuesta = ids[Math.floor(Math.random() * ids.length)]!;
  const demora = 400 + Math.random() * Math.max(300, e.restanteMs * 0.85);
  setTimeout(() => {
    // Si mientras "pensaba" la pregunta ya cerró, no responde (como un alumno que no llegó).
    if (bot.enCurso !== clave) return;
    bot.socket?.emit('juego:responder', respuesta, (r) => {
      stats.respuestas++;
      if (!r.ok) {
        stats.rechazadas++;
        // Llegar tarde es parte del juego; cualquier otro rechazo es un error.
        if (!r.error.includes('tiempo')) stats.error(`${bot.nombre}: ${r.error}`);
      }
    });
  }, demora);
}

const TEXTOS = ['Aprendí qué es una red', 'Lo de las contraseñas', 'Me costó la parte del router', 'Todo bien', 'Quiero más práctica'];
const PREGUNTAS = ['¿Esto entra en la prueba?', '¿Cómo se cambia la contraseña del WiFi?', '¿Qué diferencia hay entre módem y router?', '¿Podemos repetir lo último?'];
const azar = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/** Encuestas: cada bot responde una vez, con una demora, como un alumno. */
function alEncuesta(bot: Bot, e: EncuestaEnVivo | null): void {
  if (!e || !e.abierta || e.miRespuesta !== null || bot.encuestas.has(e.id)) return;
  bot.encuestas.add(e.id);
  if (Math.random() < PROB_NO_RESPONDE) return;
  const valor = e.tipo === 'texto' ? azar(TEXTOS) : Math.floor(Math.random() * e.opciones.length);
  setTimeout(() => {
    bot.socket?.emit('encuesta:responder', valor, (r) => {
      // Si el profe ya la cerró o la terminó mientras "pensaba", no es un error.
      if (!r.ok && !/cerró|ninguna encuesta/.test(r.error)) stats.error(`${bot.nombre}: ${r.error}`);
    });
  }, 500 + Math.random() * 4000);
}

let bots: Bot[] = [];

async function main() {
  const extras = [CAOS && 'con recargas al azar', MANOS && 'levantando la mano'].filter(Boolean).join(', ');
  log(`Conectando ${CANTIDAD} bots a ${URL_SERVIDOR} (comisión "${COMISION}")${extras ? `, ${extras}` : ''}…`);
  const { token: tokenProfe } = await api<{ token: string }>('/profe/login', { method: 'POST', body: { pin: PIN } }).catch(() => {
    throw new Error('No pude entrar como profe. ¿El servidor está andando? ¿El PIN es correcto? (usá --pin)');
  });
  bots = await prepararBots(tokenProfe);
  bots.forEach(conectar);
  log(`Listo: ${bots.length} bots conectados. Iniciá un quiz para "${COMISION}" desde /profe → Clase en vivo. Ctrl+C para salir.`);

  if (CAOS) {
    setInterval(() => {
      const bot = bots[Math.floor(Math.random() * bots.length)]!;
      log(`  ${bot.nombre} recarga la página`);
      bot.socket?.disconnect();
      setTimeout(() => conectar(bot), 300 + Math.random() * 1500);
    }, 4000);
  }

  if (MANOS) {
    setInterval(() => {
      const bot = azar(bots);
      const que = Math.random();
      if (que < 0.5) {
        const arriba = !bot.manoArriba;
        bot.socket?.emit('mano:cambiar', arriba, (r) => {
          if (!r.ok) stats.error(`${bot.nombre}: ${r.error}`);
          else log(`  ${bot.nombre} ${arriba ? 'levanta' : 'baja'} la mano`);
        });
      } else if (que < 0.85) {
        const tipo = Math.random() < 0.6 ? 'noEntendi' : 'despacio';
        bot.socket?.emit('senal:cambiar', { tipo, activa: true }, (r) => {
          if (!r.ok) stats.error(`${bot.nombre}: ${r.error}`);
          else log(`  ${bot.nombre} avisa: ${tipo === 'noEntendi' ? 'no entendí' : 'más despacio'}`);
        });
      } else {
        // Puede rebotar por mandar muy seguido: eso es esperable, no un error.
        bot.socket?.emit('pregunta:enviar', azar(PREGUNTAS), (r) => r.ok && log(`  ${bot.nombre} manda una pregunta anónima`));
      }
    }, 4000);
  }

  process.on('SIGINT', () => {
    log(`Saliendo. Respuestas: ${stats.respuestas}, rechazadas: ${stats.rechazadas}, errores: ${stats.errores.length}`);
    bots.forEach((b) => b.socket?.disconnect());
    process.exit(stats.errores.length > 0 ? 1 : 0);
  });
}

main().catch((err) => {
  console.error(`\n❌ ${(err as Error).message}\n`);
  process.exit(1);
});

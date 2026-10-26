import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  Ack,
  AlumnoConectado,
  ClientToServerEvents,
  Presencia,
  ServerToClientEvents,
  SocketAuth,
  SocketData,
} from '@aula/shared';
import { alumnoDeToken, esTokenProfe } from './auth';
import { buscarAlumno } from './db/alumnos';
import { controlarEncuesta, emitirEncuesta, encuestaPara, responderEncuesta } from './clase/encuesta';
import { bajarMano, bajarTodas, emitirManos, filaDeManos, levantarMano, miMano } from './clase/manos';
import {
  accionPreguntas,
  alSalirAlumno,
  atencionPara,
  cambiarAtencion,
  cambiarSenal,
  conteoSenales,
  enviarPregunta,
  limpiarSenales,
  misSenales,
  preguntaDestacada,
  preguntasPendientes,
} from './clase/participacion';
import { controlarPresentacion, presentacionPara } from './clase/presentacion';
import { alConectarAlumno, alDesconectarAlumno, controlar, estadoPara, partidaActual } from './juego/control';

type Io = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: Io | null = null;

/** alumnoId → ids de sockets abiertos (puede tener varias pestañas). Orden de inserción = orden de llegada. */
const conectados = new Map<number, Set<string>>();

export function presenciaActual(): Presencia {
  const presencia: Presencia = {};
  for (const alumnoId of conectados.keys()) {
    const fila = buscarAlumno(alumnoId);
    if (!fila) continue;
    const alumno: AlumnoConectado = { id: fila.id, comisionId: fila.comision_id, nombre: fila.nombre, avatar: fila.avatar };
    (presencia[fila.comision_id] ??= []).push(alumno);
  }
  return presencia;
}

export function emitirPresencia(): void {
  io?.to(['profe', 'pantalla']).emit('presencia:actualizar', presenciaActual());
}

/** Cierra las conexiones de un alumno (contraseña restaurada, alumno borrado, etc.). */
export function expulsarAlumno(alumnoId: number): void {
  if (!io) return;
  io.to(`alumno:${alumnoId}`).emit('sesion:expirada');
  io.in(`alumno:${alumnoId}`).disconnectSockets(true);
  conectados.delete(alumnoId);
  emitirPresencia();
  alDesconectarAlumno();
  bajarMano(alumnoId);
  alSalirAlumno(alumnoId);
  emitirEncuesta();
}

export function getIo(): Io | null {
  return io;
}

export function estaConectado(alumnoId: number): boolean {
  return conectados.has(alumnoId);
}

const ackSeguro = (ack: unknown) => (typeof ack === 'function' ? (ack as (r: unknown) => void) : () => {});

export function iniciarRealtime(http: HttpServer): Io {
  io = new Server(http, { serveClient: false });

  io.on('connection', (socket) => {
    const auth = (socket.handshake.auth ?? {}) as Partial<SocketAuth>;

    if (auth.rol === 'alumno') {
      const alumno = alumnoDeToken(auth.token);
      if (!alumno) {
        socket.emit('sesion:expirada');
        socket.disconnect(true);
        return;
      }
      socket.data = { rol: 'alumno', alumnoId: alumno.id, comisionId: alumno.comisionId };
      socket.join([`alumno:${alumno.id}`, `comision:${alumno.comisionId}`]);
      socket.emit('alumno:bienvenida', alumno);

      const sockets = conectados.get(alumno.id) ?? new Set<string>();
      const esNuevo = sockets.size === 0;
      sockets.add(socket.id);
      conectados.set(alumno.id, sockets);
      if (esNuevo) {
        emitirPresencia();
        if (miMano(alumno.id).arriba) emitirManos(); // el profe ve que volvió a estar conectado
        emitirEncuesta(); // cambia el "x de y respondieron"
      }

      // Reconexión: entra (o vuelve) al juego y recibe el estado completo al instante.
      const datos = { id: alumno.id, comisionId: alumno.comisionId, nombre: alumno.nombre, avatar: alumno.avatar };
      alConectarAlumno(datos);
      socket.emit('juego:estado', estadoPara('alumno', alumno.id, alumno.comisionId));
      socket.emit('presentacion:estado', presentacionPara('alumno', alumno.comisionId));
      socket.emit('mano:estado', miMano(alumno.id));
      socket.emit('senales:mias', misSenales(alumno.id));
      socket.emit('atencion:estado', atencionPara(alumno.comisionId));
      socket.emit('encuesta:estado', encuestaPara('alumno', alumno.id, alumno.comisionId));

      socket.on('senal:cambiar', (cambio, ack) => ackSeguro(ack)(cambiarSenal(alumno.id, cambio?.tipo, cambio?.activa === true)));
      socket.on('pregunta:enviar', (texto, ack) => ackSeguro(ack)(enviarPregunta(alumno.id, texto)));
      socket.on('encuesta:responder', (valor, ack) => ackSeguro(ack)(responderEncuesta(alumno.id, alumno.comisionId, valor)));

      socket.on('mano:cambiar', (arriba, ack) => {
        if (arriba === true) levantarMano(datos);
        else bajarMano(alumno.id);
        ackSeguro(ack)({ ok: true });
      });

      socket.on('juego:responder', (respuesta, ack) => {
        const responder = ackSeguro(ack);
        const partida = partidaActual();
        if (!partida || partida.comisionId !== alumno.comisionId) return responder({ ok: false, error: 'No hay ningún quiz en curso.' });
        const valida = Array.isArray(respuesta) ? respuesta.length <= 10 && respuesta.every((x) => Number.isInteger(x)) : Number.isInteger(respuesta);
        if (!valida) return responder({ ok: false, error: 'Respuesta inválida.' });
        responder(partida.responder(alumno.id, respuesta));
      });

      socket.on('disconnect', () => {
        const abiertos = conectados.get(alumno.id);
        if (!abiertos) return;
        abiertos.delete(socket.id);
        if (abiertos.size === 0) {
          conectados.delete(alumno.id);
          emitirPresencia();
          alDesconectarAlumno();
          if (miMano(alumno.id).arriba) emitirManos();
          emitirEncuesta();
        }
      });
      return;
    }

    if (auth.rol === 'profe') {
      if (!esTokenProfe(auth.token)) {
        socket.emit('sesion:expirada');
        socket.disconnect(true);
        return;
      }
      socket.data = { rol: 'profe' };
      socket.join('profe');
      socket.emit('presencia:actualizar', presenciaActual());
      socket.emit('juego:estado', estadoPara('profe'));
      socket.emit('presentacion:estado', presentacionPara('profe'));
      socket.emit('manos:actualizar', filaDeManos());
      socket.emit('senales:actualizar', conteoSenales());
      socket.emit('preguntas:actualizar', preguntasPendientes());
      socket.emit('pantalla:destacada', preguntaDestacada());
      socket.emit('atencion:estado', atencionPara());
      socket.emit('encuesta:estado', encuestaPara('profe'));

      // El token se revisa en cada acción: si el profe cerró sesión en otra pestaña, deja de valer.
      const comoProfe =
        <A>(hacer: (dato: A) => Ack) =>
        (dato: A, ack: unknown) => {
          const responder = ackSeguro(ack);
          if (!esTokenProfe(auth.token)) return responder({ ok: false, error: 'Tu sesión de profe venció.' });
          try {
            responder(hacer(dato));
          } catch (err) {
            console.error(err);
            responder({ ok: false, error: 'Algo falló en el servidor. Probá de nuevo.' });
          }
        };

      socket.on('juego:control', comoProfe(controlar));
      socket.on('presentacion:control', comoProfe(controlarPresentacion));
      socket.on('senales:limpiar', comoProfe(limpiarSenales));
      socket.on('preguntas:accion', comoProfe(accionPreguntas));
      socket.on('atencion:cambiar', comoProfe(cambiarAtencion));
      socket.on('encuesta:control', comoProfe(controlarEncuesta));
      socket.on(
        'manos:bajar',
        comoProfe((alumnoId: number | null) => {
          if (alumnoId === null) bajarTodas();
          else bajarMano(Number(alumnoId));
          return { ok: true };
        }),
      );
      return;
    }

    // La pantalla grande es de solo lectura: no necesita token.
    socket.data = { rol: 'pantalla' };
    socket.join('pantalla');
    socket.emit('presencia:actualizar', presenciaActual());
    socket.emit('juego:estado', estadoPara('pantalla'));
    socket.emit('presentacion:estado', presentacionPara('pantalla'));
    socket.emit('pantalla:destacada', preguntaDestacada());
    socket.emit('encuesta:estado', encuestaPara('pantalla'));
  });

  return io;
}

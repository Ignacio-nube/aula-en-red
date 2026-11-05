import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HardDrive, LogOut, Pencil, WifiOff } from 'lucide-react';
import { Estanque } from '@/components/estanque/Estanque';
import type { AlumnoPublico } from '@aula/shared';
import { BotonLiviano } from '@/components/pd/BotonLiviano';
import { BotonTema } from '@/components/pd/BotonTema';
import { MascotaEquipo } from '@/components/pd/Equipo';
import { Logo } from '@/components/pd/Logo';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { useAtencion, useEncuesta, useMiMano, usePresentacion } from '@/lib/clase';
import { formatoPuntos, useJuego } from '@/lib/juego';
import { useLiviano } from '@/lib/liviano';
import { useCortado, useSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { definicionDe } from '@/actividades/registro';
import { useActividad } from '@/lib/actividad';
import { BarraParticipacion } from './BarraParticipacion';
import { DriveLibre } from './DriveLibre';
import { ElegirEmoji } from './EditarEmoji';
import { EncuestaAlumno, PantallaAtencion } from './EncuestaAlumno';
import { JuegoAlumno } from './JuegoAlumno';
import { PresentacionAlumno } from './PresentacionAlumno';

interface Props {
  token: string;
  alumno: AlumnoPublico;
  nombreCurso?: string;
  onSalir: (motivo?: string) => void;
  onActualizar: (alumno: AlumnoPublico) => void;
}

export function SalaEspera({ token, alumno, nombreCurso, onSalir, onActualizar }: Props) {
  const socket = useSocket({ rol: 'alumno', token });
  const liviano = useLiviano();
  const [editando, setEditando] = useState(false);
  const cerrarEmoji = useCallback(() => setEditando(false), []);
  const [enDrive, setEnDrive] = useState(false);
  const cortado = useCortado(socket);
  const { estado, recibido } = useJuego(socket);
  const presentacion = usePresentacion(socket);
  const mano = useMiMano(socket);
  const encuesta = useEncuesta(socket);
  const atencion = useAtencion(socket);
  const actividad = useActividad(socket);
  const Actividad = actividad.estado ? definicionDe(actividad.estado).Alumno : null;
  // Una actividad terminada (mostrando resultados) se puede dejar: no hay nada que perder.
  const actividadEnCurso = actividad.estado ? definicionDe(actividad.estado).enCurso(actividad.estado) : false;
  const enJuego = estado !== null;
  // Lo que esté pasando en la clase. Prioridad: quiz, actividad, encuesta, presentación, espera.
  const ocupado = enJuego || actividad.estado !== null || presentacion !== null || encuesta !== null;
  // Su Drive, para practicar mientras espera: si arranca algo de la clase, eso tiene prioridad.
  const conDrive = enDrive && !ocupado;
  const compacto = ocupado || conDrive;

  useEffect(() => {
    if (!socket) return;
    const expirada = () => onSalir('Se cerró tu sesión (dura 2 horas). Volvé a ingresar con tu contraseña.');
    socket.on('sesion:expirada', expirada);
    socket.on('alumno:bienvenida', onActualizar);
    return () => {
      socket.off('sesion:expirada', expirada);
      socket.off('alumno:bienvenida', onActualizar);
    };
  }, [socket, onSalir, onActualizar]);

  // Esperando al profe: el estanque de fondo (salvo en modo liviano, que es para compus lentas).
  const esperando = !compacto;
  const conEstanque = esperando && !liviano;
  const pastilla = (
    <>
      <PinAvatar avatar={alumno.avatar} tamano={compacto ? 30 : 36} />
      <span className="max-w-[40vw] truncate text-base font-semibold">{alumno.nombre}</span>
      {enJuego && estado.yo?.equipo !== undefined && <MascotaEquipo indice={estado.yo.equipo} className="size-7 text-[1.75rem]" />}
      {enJuego && estado.yo && estado.fase !== 'lobby' && (
        <span className="ml-1 rounded-full bg-pd-celeste-claro px-2.5 py-0.5 text-sm font-bold tabular-nums">{formatoPuntos(estado.yo.puntos)} pts</span>
      )}
    </>
  );

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden', esperando && 'bg-estanque')}>
      {/* Mientras elige el emoji, los peces se quedan quietos y se apagan: no compiten con la grilla. */}
      {conEstanque && <Estanque className={cn('absolute inset-0 size-full', editando && 'opacity-30')} pausado={editando} />}
      <div className={cn('relative flex items-center justify-between gap-4 px-4 sm:px-6', compacto ? 'py-2' : 'py-4')}>
        <div data-koi-avoid className="vidrio flex items-center gap-3 rounded-full py-1.5 pr-5 pl-2 shadow-[var(--pd-sombra-tarjeta)]">
          {pastilla}
        </div>
        {presentacion && !enJuego && !encuesta && <p className="hidden min-w-0 truncate font-semibold md:block">{presentacion.titulo}</p>}
        <span data-koi-avoid>
          <Logo alto={compacto ? 40 : 50} />
        </span>
      </div>

      {enJuego ? (
        <JuegoAlumno estado={estado} recibido={recibido} socket={socket} alumno={alumno} />
      ) : Actividad && actividad.estado ? (
        <Actividad estado={actividad.estado} recibido={actividad.recibido} socket={socket} alumno={alumno} token={token} />
      ) : encuesta ? (
        <EncuestaAlumno encuesta={encuesta} socket={socket} />
      ) : presentacion ? (
        <PresentacionAlumno estado={presentacion} socket={socket} mano={mano} />
      ) : conDrive ? (
        <DriveLibre token={token} socket={socket} alumno={alumno} onCerrar={() => setEnDrive(false)} />
      ) : editando ? (
        <ElegirEmoji onVolver={cerrarEmoji} token={token} alumno={alumno} onGuardado={onActualizar} />
      ) : (
        <Espera alumno={alumno} nombreCurso={nombreCurso} conEstanque={conEstanque} onEditar={() => setEditando(true)}>
          <Button size="lg" variant="outline" className="vidrio mx-auto rounded-full" onClick={() => setEnDrive(true)}>
            <HardDrive data-icon="inline-start" />
            Abrir mi Drive
          </Button>
          <BarraParticipacion socket={socket} mano={mano} className="justify-center" />
        </Espera>
      )}

      <PantallaAtencion atencion={atencion} />

      <AnimatePresence>
        {cortado && (
          <motion.div
            className="absolute inset-x-0 top-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-[var(--pd-sombra-flotante)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
          >
            <WifiOff className="size-4 text-destructive" />
            Se cortó la conexión. Reintentando…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Durante el quiz o la presentación no se ofrece salir: un toque sin querer los sacaría. */}
      <div
        data-koi-avoid
        className={cn(
          'absolute right-4 bottom-4 flex items-center gap-1',
          esperando && 'vidrio rounded-full p-1 shadow-[var(--pd-sombra-tarjeta)]',
          ((enJuego && estado.fase !== 'podio') ||
            actividadEnCurso ||
            conDrive ||
            actividad.estado?.tipo === 'drive' ||
            (!enJuego && !actividad.estado && (presentacion || encuesta))) &&
            'hidden',
        )}
      >
        <BotonTema />
        <BotonLiviano />
        <Button variant="ghost" size="sm" onClick={() => onSalir()}>
          <LogOut data-icon="inline-start" />
          Salir
        </Button>
      </div>
    </div>
  );
}

/** La espera: quién sos (tocás tu pin para cambiar el emoji) y que el profe ya va a arrancar. */
function Espera({
  alumno,
  nombreCurso,
  conEstanque,
  onEditar,
  children,
}: {
  alumno: AlumnoPublico;
  nombreCurso?: string;
  conEstanque: boolean;
  onEditar: () => void;
  children: ReactNode;
}) {
  const primerNombre = alumno.nombre.split(' ')[0];
  return (
    // Centrado con my-auto (no justify-center): si no entra en pantallas bajas, arranca desde arriba y se
    // scrollea, en vez de quedar el pin cortado debajo del encabezado. El pt deja lugar al vaivén del pin.
    <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-4 pb-20 text-center bajo:pb-14">
      <div data-koi-avoid className="my-auto flex flex-col items-center gap-6 bajo:gap-3">
        <motion.button
          type="button"
          onClick={onEditar}
          aria-label="Cambiar tu emoji"
          title="Cambiar tu emoji"
          className="group relative rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/50 bajo:-my-3 bajo:scale-75"
          animate={conEstanque ? { y: [0, -8, 0] } : undefined}
          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
          whileTap={{ scale: 0.94 }}
        >
          <PinAvatar avatar={alumno.avatar} tamano={112} className="max-sm:scale-90" />
          <span className="absolute right-0 bottom-3 grid size-9 place-items-center rounded-full bg-card text-foreground shadow-[var(--pd-sombra-flotante)] transition-transform group-hover:scale-110">
            <Pencil className="size-4" />
          </span>
        </motion.button>
        <div className="flex flex-col gap-3">
          <p className="text-xl font-semibold text-muted-foreground sm:text-2xl">Hola, {primerNombre}</p>
          <h1 className="text-4xl font-extrabold text-balance sm:text-6xl bajo:text-3xl">
            Esperando al profe
            <Puntitos animar={conEstanque} />
          </h1>
          <p className="mx-auto max-w-md text-lg text-balance text-muted-foreground sm:text-xl">
            {nombreCurso ? `${nombreCurso}. ` : ''}Cuando arranque la actividad, aparece acá sola.
          </p>
        </div>
        {children}
        {conEstanque && <p className="text-sm font-medium text-muted-foreground">Mientras tanto, tocá el agua para darles de comer a los peces.</p>}
      </div>
    </div>
  );
}

/** Los tres puntos de "esperando", que se prenden de a uno. */
function Puntitos({ animar }: { animar: boolean }) {
  if (!animar) return <span aria-hidden>…</span>;
  return (
    <span aria-hidden className="inline-flex w-[1.2em]">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.15, 1, 0.15] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}>
          .
        </motion.span>
      ))}
    </span>
  );
}

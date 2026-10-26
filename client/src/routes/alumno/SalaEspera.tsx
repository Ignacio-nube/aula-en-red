import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, WifiOff } from 'lucide-react';
import type { AlumnoPublico } from '@aula/shared';
import { BotonLiviano } from '@/components/pd/BotonLiviano';
import { BotonTema } from '@/components/pd/BotonTema';
import { Logo } from '@/components/pd/Logo';
import { PinAvatar, PinLoader } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { useAtencion, useEncuesta, useMiMano, usePresentacion } from '@/lib/clase';
import { formatoPuntos, useJuego } from '@/lib/juego';
import { useConectado, useSocket } from '@/lib/socket';
import { BarraParticipacion } from './BarraParticipacion';
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
  const conectado = useConectado(socket);
  const { estado, recibido } = useJuego(socket);
  const presentacion = usePresentacion(socket);
  const mano = useMiMano(socket);
  const encuesta = useEncuesta(socket);
  const atencion = useAtencion(socket);
  const enJuego = estado !== null;
  // Lo que esté pasando en la clase. Prioridad: quiz, encuesta, presentación, espera.
  const compacto = enJuego || presentacion !== null || encuesta !== null;

  useEffect(() => {
    if (!socket) return;
    const expirada = () => onSalir('Tu sesión terminó. Volvé a ingresar.');
    socket.on('sesion:expirada', expirada);
    socket.on('alumno:bienvenida', onActualizar);
    return () => {
      socket.off('sesion:expirada', expirada);
      socket.off('alumno:bienvenida', onActualizar);
    };
  }, [socket, onSalir, onActualizar]);

  return (
    <div className={`relative flex h-dvh flex-col overflow-hidden ${compacto ? '' : 'bg-pd-celeste-claro/50'}`}>
      <div className={`flex items-center justify-between gap-4 px-4 sm:px-6 ${compacto ? 'py-2' : 'py-4'}`}>
        <div className="vidrio flex items-center gap-3 rounded-full py-1.5 pr-5 pl-2 shadow-[var(--pd-sombra-tarjeta)]">
          <PinAvatar avatar={alumno.avatar} tamano={compacto ? 30 : 36} />
          <span className="max-w-[40vw] truncate text-base font-semibold">{alumno.nombre}</span>
          {enJuego && estado.yo && estado.fase !== 'lobby' && (
            <span className="ml-1 rounded-full bg-pd-celeste-claro px-2.5 py-0.5 text-sm font-bold tabular-nums">
              {formatoPuntos(estado.yo.puntos)} pts
            </span>
          )}
        </div>
        {presentacion && !enJuego && !encuesta && <p className="hidden min-w-0 truncate font-semibold md:block">{presentacion.titulo}</p>}
        <Logo alto={compacto ? 40 : 50} />
      </div>

      {enJuego ? (
        <JuegoAlumno estado={estado} recibido={recibido} socket={socket} alumno={alumno} />
      ) : encuesta ? (
        <EncuestaAlumno encuesta={encuesta} socket={socket} />
      ) : presentacion ? (
        <PresentacionAlumno estado={presentacion} socket={socket} mano={mano} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-4 pb-16 text-center bajo:gap-4 bajo:pb-12">
          <PinLoader tamano={92} className="max-sm:scale-75 bajo:hidden" />
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold text-balance sm:text-5xl bajo:text-3xl">Esperando al profe…</h1>
            <p className="text-lg text-balance text-muted-foreground sm:text-xl">
              {nombreCurso ? `${nombreCurso}. ` : ''}Cuando arranque la actividad, aparece acá sola.
            </p>
          </div>
          <BarraParticipacion socket={socket} mano={mano} className="justify-center" />
        </div>
      )}

      <PantallaAtencion atencion={atencion} />

      <AnimatePresence>
        {socket && !conectado && (
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
      <div className={`absolute right-4 bottom-4 flex items-center gap-1 ${(enJuego && estado.fase !== 'podio') || (!enJuego && (presentacion || encuesta)) ? 'hidden' : ''}`}>
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

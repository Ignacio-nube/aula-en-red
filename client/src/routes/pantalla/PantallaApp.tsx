import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize, Volume2, VolumeX, WifiOff } from 'lucide-react';
import type { Comision } from '@aula/shared';
import { BotonLiviano } from '@/components/pd/BotonLiviano';
import { BotonTema } from '@/components/pd/BotonTema';
import { Logo } from '@/components/pd/Logo';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useDestacada, useEncuesta, usePresentacion } from '@/lib/clase';
import { useInfo } from '@/lib/info';
import { nombresCortos } from '@/lib/nombres';
import { useJuego } from '@/lib/juego';
import { activarSonido, sonidoActivado } from '@/lib/sonidos';
import { useConectado, usePresencia, useSocket } from '@/lib/socket';
import { JuegoPantalla } from './JuegoPantalla';
import { EncuestaPantalla, PreguntaDestacada } from './EncuestaPantalla';
import { PresentacionPantalla } from './PresentacionPantalla';

const AUTH_PANTALLA = { rol: 'pantalla' } as const;

/** Vista para la TV o el proyector: cómo unirse y quién ya entró. */
export function PantallaApp() {
  const socket = useSocket(AUTH_PANTALLA);
  const conectado = useConectado(socket);
  const presencia = usePresencia(socket);
  const info = useInfo(socket);
  const { estado, recibido } = useJuego(socket);
  const presentacion = usePresentacion(socket);
  const encuesta = useEncuesta(socket);
  const destacada = useDestacada(socket);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [sonido, setSonido] = useState(sonidoActivado);

  const grupos = Object.entries(presencia).filter(([, lista]) => lista.length > 0);
  const total = grupos.reduce((n, [, lista]) => n + lista.length, 0);

  // Nombres de las comisiones para los títulos de cada grupo.
  const idsConGente = grupos.map(([id]) => id).join(',');
  useEffect(() => {
    if (!idsConGente) return;
    api<Comision[]>('/comisiones')
      .then(setComisiones)
      .catch(() => {});
  }, [idsConGente]);

  const direccion = info?.url.replace(/^https?:\/\//, '') ?? '';
  const cortos = nombresCortos(grupos.flatMap(([, lista]) => lista));

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden px-[4vw] pt-[3vh] pb-[4vh]">
      {estado ? (
        <JuegoPantalla estado={estado} recibido={recibido} info={info} />
      ) : encuesta ? (
        <EncuestaPantalla encuesta={encuesta} />
      ) : presentacion ? (
        <PresentacionPantalla estado={presentacion} />
      ) : (
      <>
      <section className="grid flex-none grid-cols-[1fr_auto] items-center gap-[4vw]">
        <div className="flex min-w-0 flex-col gap-[2.2vh]">
          <Logo alto={110} className="-ml-3 self-start" />
          <h1 className="text-[clamp(2rem,4.2vw,5rem)] leading-[1.05] font-extrabold">{info?.nombreCurso ?? ' '}</h1>
          <div className="flex flex-col gap-1">
            <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-medium text-muted-foreground">Entrá desde el navegador a</p>
            <p className="text-[clamp(2.6rem,6.4vw,8rem)] leading-none font-extrabold tracking-tight text-pd-celeste-oscuro tabular-nums">
              {direccion}
            </p>
          </div>
        </div>
        {info && (
          <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-card p-[1.6vw] shadow-[var(--pd-sombra-flotante)]">
            <img src={info.qr} alt={`Código QR para entrar a ${info.url}`} className="size-[min(22vw,36vh)] [image-rendering:pixelated]" />
            <p className="text-[clamp(0.9rem,1.2vw,1.4rem)] font-medium text-muted-foreground">o escaneá con el celu</p>
          </div>
        )}
      </section>

      <section className="mt-[4vh] flex min-h-0 flex-1 flex-col gap-[2vh] rounded-[2.5rem] bg-pd-celeste-claro/70 px-[3vw] py-[3vh]">
        <h2 className="text-[clamp(1.2rem,2vw,2.4rem)] font-bold">
          {total === 0 ? 'Todavía no entró nadie' : total === 1 ? 'Ya entró 1 persona' : `Ya entraron ${total}`}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-[2vh] overflow-hidden">
          {grupos.map(([id, lista]) => (
            <div key={id} className="flex flex-col gap-[1.2vh]">
              {grupos.length > 1 && (
                <p className="text-[clamp(1rem,1.4vw,1.6rem)] font-semibold text-muted-foreground">
                  {comisiones.find((c) => c.id === Number(id))?.nombre ?? 'Comisión'}
                </p>
              )}
              <ul className="flex flex-wrap gap-x-[2.2vw] gap-y-[2vh]">
                <AnimatePresence mode="popLayout">
                  {lista.map((a) => (
                    <motion.li
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 40, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      className="flex w-[clamp(5.5rem,8vw,10rem)] flex-col items-center gap-2 text-center"
                    >
                      <PinAvatar avatar={a.avatar} tamano={72} />
                      <span className="w-full truncate text-[clamp(0.95rem,1.3vw,1.6rem)] font-semibold">{cortos.get(a.id)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      <PreguntaDestacada texto={destacada} />

      <AnimatePresence>
        {socket && !conectado && (
          <motion.div
            className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-5 py-2.5 font-medium shadow-[var(--pd-sombra-flotante)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
          >
            <WifiOff className="size-5 text-destructive" />
            Sin conexión con el servidor. Reintentando…
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`absolute right-3 bottom-3 flex gap-1 transition-opacity focus-within:opacity-100 hover:opacity-100 ${presentacion && !estado && !encuesta ? 'opacity-0' : 'opacity-30'}`}
      >
        <BotonTema />
        <BotonLiviano />
        {/* El navegador solo deja reproducir sonido después de un clic en la página. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={sonido ? 'Silenciar' : 'Activar sonido'}
          aria-pressed={sonido}
          onClick={() => {
            activarSonido(!sonido);
            setSonido(!sonido);
          }}
        >
          {sonido ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Pantalla completa"
          onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
        >
          <Maximize />
        </Button>
      </div>
    </main>
  );
}

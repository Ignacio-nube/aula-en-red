import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, LogOut, Menu, MonitorPlay, MonitorUp, Moon, Presentation, Puzzle, Settings, Sun, SunMoon, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BarraVidrio } from '@/components/pd/BarraVidrio';
import { BotonTema } from '@/components/pd/BotonTema';
import { Fallo } from '@/components/pd/Fallo';
import { Logo } from '@/components/pd/Logo';
import { PinLoader } from '@/components/pd/Pin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ErrorApi } from '@/lib/api';
import { CLAVES, guardar, leer } from '@/lib/almacen';
import { useAtencion, useDestacada, useEncuesta, useManos, usePreguntasAnonimas, usePresentacion, useSenales } from '@/lib/clase';
import { emitirConAck, useJuego } from '@/lib/juego';
import { useActividad } from '@/lib/actividad';
import { cambiarLiviano, useLiviano } from '@/lib/liviano';
import { MOVIMIENTO } from '@/lib/movimiento';
import { prepararAudioConPrimerClic } from '@/lib/sonidos';
import { cambiarTema, NOMBRE_TEMA, useTema } from '@/lib/tema';
import { usePresencia, useSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Ajustes } from './Ajustes';
import { ClaseEnVivo } from './clase/ClaseEnVivo';
import { Comisiones } from './Comisiones';
import { ContextoProfe, type Profe } from './contexto';
import { IngresoPin } from './IngresoPin';
import { PanelParticipacion } from './PanelParticipacion';
import { Presentaciones } from './presentaciones/Presentaciones';
import { Quizzes } from './quizzes/Quizzes';
import { Resultados } from './resultados/Resultados';

export function ProfeApp() {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const guardado = leer(CLAVES.tokenProfe);
    if (!guardado) return setToken(null);
    api('/profe/yo', { token: guardado })
      .then(() => setToken(guardado))
      .catch(() => {
        guardar(CLAVES.tokenProfe, null);
        setToken(null);
      });
  }, []);

  const entrar = (t: string) => {
    guardar(CLAVES.tokenProfe, t);
    setToken(t);
  };

  const salir = useCallback(() => {
    guardar(CLAVES.tokenProfe, null);
    setToken(null);
  }, []);

  if (token === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <PinLoader />
      </main>
    );
  }
  if (token === null) return <IngresoPin onEntrar={entrar} />;
  return <Panel token={token} onSalir={salir} />;
}

function Panel({ token, onSalir }: { token: string; onSalir: () => void }) {
  const socket = useSocket({ rol: 'profe', token });
  const presencia = usePresencia(socket);
  const juego = useJuego(socket);
  const presentacion = usePresentacion(socket);
  const manos = useManos(socket);
  const senales = useSenales(socket);
  const preguntas = usePreguntasAnonimas(socket);
  const destacada = useDestacada(socket);
  const atencion = useAtencion(socket);
  const encuesta = useEncuesta(socket);
  const actividad = useActividad(socket);
  const liviano = useLiviano();
  const { preferencia: tema } = useTema();
  const [ajustesAbierto, setAjustesAbierto] = useState(false);
  // Se arranca en Clase en vivo: es lo que se usa en el aula. Sin comisiones, ahí mismo invita a crear una.
  const [pestana, setPestana] = useState('clase');
  const [presentacionElegida, setPresentacionElegida] = useState<number | null>(null);

  useEffect(prepararAudioConPrimerClic, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('sesion:expirada', onSalir);
    return () => {
      socket.off('sesion:expirada', onSalir);
    };
  }, [socket, onSalir]);

  const pedir = useCallback<Profe['pedir']>(
    async (ruta, opciones) => {
      try {
        return await api(ruta, { ...opciones, token });
      } catch (err) {
        if (err instanceof ErrorApi && err.status === 401) {
          toast.error('Tu sesión de profe venció. Ingresá el PIN de nuevo.');
          onSalir();
        }
        throw err;
      }
    },
    [token, onSalir],
  );

  const controlar = useCallback<Profe['controlar']>((accion) => emitirConAck(socket, 'juego:control', accion), [socket]);
  const controlarPresentacion = useCallback<Profe['controlarPresentacion']>((accion) => emitirConAck(socket, 'presentacion:control', accion), [socket]);
  const controlarActividad = useCallback<Profe['controlarActividad']>((accion) => emitirConAck(socket, 'actividad:control', accion), [socket]);
  const contexto = useMemo<Profe>(
    () => ({
      pedir,
      presencia,
      juego,
      controlar,
      presentacion,
      controlarPresentacion,
      presentacionElegida,
      elegirPresentacion: setPresentacionElegida,
      irA: setPestana,
      socket,
      senales,
      preguntas,
      destacada,
      atencion,
      encuesta,
      actividad,
      controlarActividad,
    }),
    [
      pedir,
      presencia,
      juego,
      controlar,
      presentacion,
      controlarPresentacion,
      presentacionElegida,
      socket,
      senales,
      preguntas,
      destacada,
      atencion,
      encuesta,
      actividad,
      controlarActividad,
    ],
  );
  const hayClase =
    (juego.estado !== null && juego.estado.fase !== 'podio') || presentacion !== null || encuesta !== null || atencion !== null || actividad.estado !== null;
  const totalConectados = Object.values(presencia).reduce((n, lista) => n + lista.length, 0);

  const cerrarSesion = () => {
    void api('/profe/logout', { method: 'POST', token }).catch(() => {});
    onSalir();
  };

  return (
    <ContextoProfe.Provider value={contexto}>
      <Tabs value={pestana} onValueChange={setPestana} className="min-h-dvh gap-0">
        <BarraVidrio>
          <div className="mx-auto flex max-w-7xl items-center gap-x-3 px-4 py-2 sm:px-6 lg:gap-x-6">
            <div className="flex items-center gap-3">
              <Logo alto={46} />
              {/* Entre 1024 y 1536 px no entra junto a las pestañas y el botón de la pantalla grande. */}
              <span className="text-lg font-bold whitespace-nowrap max-[360px]:hidden lg:max-2xl:hidden">Panel del profe</span>
            </div>
            {/* En el celu y la tablet, las pestañas van en la barra de abajo (BarraInferior). */}
            <TabsList className="isolate hidden bg-muted/80 lg:flex lg:w-fit">
              <TabsTrigger value="clase" className={PESTANA}>
                <Indicador activa={pestana === 'clase'} />
                <MonitorPlay data-icon="inline-start" />
                Clase en vivo
                {hayClase && <span className="latido size-2 rounded-full bg-pd-resp-b" aria-label="(en curso)" />}
              </TabsTrigger>
              <TabsTrigger value="quizzes" className={PESTANA}>
                <Indicador activa={pestana === 'quizzes'} />
                <Puzzle data-icon="inline-start" />
                Quizzes
              </TabsTrigger>
              <TabsTrigger value="presentaciones" className={PESTANA}>
                <Indicador activa={pestana === 'presentaciones'} />
                <Presentation data-icon="inline-start" />
                Presentaciones
              </TabsTrigger>
              <TabsTrigger value="comisiones" className={PESTANA}>
                <Indicador activa={pestana === 'comisiones'} />
                <Users data-icon="inline-start" />
                <span className="max-xl:hidden">Comisiones y alumnos</span>
                <span className="xl:hidden">Alumnos</span>
              </TabsTrigger>
              <TabsTrigger value="resultados" className={PESTANA}>
                <Indicador activa={pestana === 'resultados'} />
                <BarChart3 data-icon="inline-start" />
                Resultados
              </TabsTrigger>
            </TabsList>
            <div className="ml-auto flex items-center gap-2">
              {/* La pantalla grande se abre seguido: va a mano y no escondida en el menú. */}
              <Button variant="outline" size="sm" className="max-sm:hidden" onClick={() => window.open('/pantalla', 'aula-pantalla')}>
                <MonitorUp data-icon="inline-start" />
                <span className="lg:max-xl:sr-only">Pantalla grande</span>
              </Button>
              <Badge variant={totalConectados > 0 ? 'default' : 'secondary'}>
                {/* El número salta cuando entra o sale alguien. */}
                <motion.span key={totalConectados} className="inline-block" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={MOVIMIENTO.rebote}>
                  {totalConectados}
                </motion.span>
                <span className="max-sm:sr-only lg:max-xl:sr-only">{totalConectados === 1 ? ' conectado' : ' conectados'}</span>
                <Users className="sm:hidden" aria-hidden />
              </Badge>
              {/* Entre 1024 y 1280 px no entra: ahí el tema se cambia desde el menú. */}
              <BotonTema className="max-sm:hidden lg:max-xl:hidden" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Más opciones">
                    <Menu />
                  </Button>
                </DropdownMenuTrigger>
                {/* Agrupado por para qué sirve: la clase, cómo se ve esta compu, y salir. */}
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>La clase</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => window.open('/pantalla', 'aula-pantalla')}>
                      <MonitorUp />
                      <ItemConDetalle titulo="Abrir la pantalla grande" detalle="Para el proyector o el televisor" />
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAjustesAbierto(true)}>
                      <Settings />
                      <ItemConDetalle titulo="Ajustes del curso" detalle="Nombre del curso y contraseñas" />
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>En esta compu</DropdownMenuLabel>
                    {/* El tema se elige con tres botones dentro del menú: se ve el cambio sin cerrarlo. */}
                    <div role="radiogroup" aria-label="Tema" className="mx-1.5 mb-1 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                      {(['claro', 'oscuro', 'auto'] as const).map((t) => {
                        const Icono = t === 'claro' ? Sun : t === 'oscuro' ? Moon : SunMoon;
                        return (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={tema === t}
                            onClick={() => cambiarTema(t)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
                              tema === t && 'bg-card text-foreground shadow-sm',
                            )}
                          >
                            <Icono className="size-4" />
                            {t === 'auto' ? 'Automático' : NOMBRE_TEMA[t]}
                          </button>
                        );
                      })}
                    </div>
                    <DropdownMenuItem
                      role="menuitemcheckbox"
                      aria-checked={liviano}
                      onSelect={(ev) => {
                        ev.preventDefault(); // el menú queda abierto para ver el cambio
                        cambiarLiviano(!liviano);
                      }}
                    >
                      <ItemConDetalle titulo="Modo liviano" detalle="Menos animaciones, para compus lentas" />
                      <Switch checked={liviano} tabIndex={-1} aria-hidden className="pointer-events-none ml-auto" />
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" onSelect={cerrarSesion}>
                      <LogOut />
                      Salir del panel
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </BarraVidrio>

        {/* En el celu, abajo quedan fijas la barra de pestañas, la pastilla de participación y (en una presentación) el control remoto. */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-[calc(9rem+var(--extra-abajo,0px)+env(safe-area-inset-bottom))] sm:px-6 lg:pb-20">
          <TabsContent
            value="comisiones"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
          >
            <Fallo vista="profe" seccion clave={pestana}>
              <Comisiones />
            </Fallo>
          </TabsContent>
          {/* Siempre montado: cambiar de pestaña no pierde lo que se está editando. */}
          <TabsContent
            value="quizzes"
            forceMount
            className="data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
          >
            <Fallo vista="profe" seccion clave={pestana}>
              <Quizzes />
            </Fallo>
          </TabsContent>
          {/* También siempre montado: una subida larga sigue aunque cambies de pestaña. */}
          <TabsContent
            value="presentaciones"
            forceMount
            className="data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
          >
            <Fallo vista="profe" seccion clave={pestana}>
              <Presentaciones />
            </Fallo>
          </TabsContent>
          <TabsContent
            value="clase"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
          >
            <Fallo vista="profe" seccion clave={pestana}>
              <ClaseEnVivo />
            </Fallo>
          </TabsContent>
          <TabsContent
            value="resultados"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
          >
            <Fallo vista="profe" seccion clave={pestana}>
              <Resultados />
            </Fallo>
          </TabsContent>
        </div>
      </Tabs>

      <BarraInferior pestana={pestana} onCambiar={setPestana} hayClase={hayClase} />
      <Ajustes abierto={ajustesAbierto} onCambiarAbierto={setAjustesAbierto} />
      <Fallo vista="profe (participación)" seccion>
        <PanelParticipacion manos={manos} socket={socket} senales={senales} preguntas={preguntas} destacada={destacada} />
      </Fallo>
    </ContextoProfe.Provider>
  );
}

/** Las pestañas de arriba no pintan su propio fondo: lo hace el indicador, que se desliza de una a otra. */
const PESTANA = 'border-transparent! bg-transparent! shadow-none!';

function Indicador({ activa }: { activa: boolean }) {
  if (!activa) return null;
  return (
    <motion.span
      layoutId="pestana-superior"
      className="absolute inset-0 -z-10 rounded-full bg-card shadow-sm ring-1 ring-foreground/5"
      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
    />
  );
}

function ItemConDetalle({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">{titulo}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </span>
  );
}

const PESTANAS = [
  { valor: 'clase', texto: 'En vivo', icono: MonitorPlay },
  { valor: 'quizzes', texto: 'Quizzes', icono: Puzzle },
  { valor: 'presentaciones', texto: 'Presentar', icono: Presentation },
  { valor: 'comisiones', texto: 'Alumnos', icono: Users },
  { valor: 'resultados', texto: 'Resultados', icono: BarChart3 },
] as const;

/** Barra de pestañas abajo, estilo iOS, para usar el panel desde el celu (por ejemplo, como control remoto). */
function BarraInferior({ pestana, onCambiar, hayClase }: { pestana: string; onCambiar: (p: string) => void; hayClase: boolean }) {
  return (
    <nav aria-label="Secciones" className="vidrio fixed inset-x-0 bottom-0 z-30 border-t border-foreground/5 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {PESTANAS.map(({ valor, texto, icono: Icono }) => {
          const activa = pestana === valor;
          return (
            <li key={valor}>
              <button
                type="button"
                aria-current={activa ? 'page' : undefined}
                onClick={() => onCambiar(valor)}
                className={cn(
                  'relative flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.7rem] font-semibold outline-none focus-visible:bg-muted',
                  activa ? 'text-acento' : 'text-muted-foreground',
                )}
              >
                {activa && (
                  <motion.span
                    layoutId="pestana-inferior"
                    className="absolute inset-x-3 top-1 bottom-1 -z-10 rounded-2xl bg-pd-celeste-claro"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">
                  <Icono className="size-6" strokeWidth={activa ? 2.3 : 1.8} />
                  {valor === 'clase' && hayClase && (
                    <span className="latido absolute -top-0.5 -right-1 size-2.5 rounded-full bg-pd-resp-b ring-2 ring-background" aria-label="(en curso)" />
                  )}
                </span>
                {texto}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { Check, Keyboard, Pause } from 'lucide-react';
import { equipo, type EstadoJuego, type FaseJuego, type FilaEquipo, type InfoServidor } from '@aula/shared';
import { MascotaEquipo } from '@/components/pd/Equipo';
import { Numero } from '@/components/pd/Numero';
import { PinAvatar } from '@/components/pd/Pin';
import { BotonRespuesta, estiloRespuesta, FormaRespuesta } from '@/components/pd/Respuesta';
import { Temporizador } from '@/components/pd/Temporizador';
import { formatoPuntos, ordinal, urlImagen, useRestante } from '@/lib/juego';
import { sonidos } from '@/lib/sonidos';
import { nombresCortos } from '@/lib/nombres';
import { escalon, MOVIMIENTO } from '@/lib/movimiento';
import { cn } from '@/lib/utils';
import { Carriles } from '@/actividades/tipeo/Pantalla';
import { estallido, Podio } from './Podio';

interface Props {
  estado: EstadoJuego;
  recibido: number;
  info: InfoServidor | null;
}

/** Cada fase entra a su manera: la pregunta baja, el resultado se acerca, el ranking llega de costado. */
const ENTRADA: Record<FaseJuego, { x?: number; y?: number; scale?: number }> = {
  lobby: { y: 28, scale: 0.985 },
  cuenta: { scale: 0.8 },
  pregunta: { y: -36 },
  resultado: { scale: 1.05 },
  ranking: { x: 90 },
  podio: { y: 40, scale: 0.97 },
};

export function JuegoPantalla({ estado, recibido, info }: Props) {
  const clave = `${estado.fase}-${estado.indice}`;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={clave}
        className="flex h-full min-h-0 flex-col"
        initial={{ opacity: 0, ...ENTRADA[estado.fase] }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: MOVIMIENTO.suave }}
        exit={{ opacity: 0, scale: 0.98, transition: MOVIMIENTO.salida }}
      >
        {estado.fase === 'lobby' && <Sala estado={estado} info={info} />}
        {estado.fase === 'cuenta' && <Cuenta estado={estado} recibido={recibido} />}
        {estado.fase === 'pregunta' && <Pregunta estado={estado} recibido={recibido} />}
        {estado.fase === 'resultado' && <Resultado estado={estado} />}
        {estado.fase === 'ranking' && <Ranking estado={estado} />}
        {estado.fase === 'podio' && <Podio estado={estado} />}
      </motion.div>
    </AnimatePresence>
  );
}

// --- sala de espera -----------------------------------------------------------------

function Sala({ estado, info }: { estado: EstadoJuego; info: InfoServidor | null }) {
  const cantidad = useRef(estado.ranking.length);
  useEffect(() => {
    if (estado.ranking.length > cantidad.current) sonidos.pop();
    cantidad.current = estado.ranking.length;
  }, [estado.ranking.length]);

  const direccion = info?.url.replace(/^https?:\/\//, '') ?? '';
  const cortos = nombresCortos(estado.ranking.map((r) => ({ id: r.alumnoId, nombre: r.nombre })));
  return (
    <div className="flex h-full flex-col gap-[3vh]">
      <div className="grid grid-cols-[1fr_auto] items-center gap-[3vw]">
        <div className="flex min-w-0 flex-col gap-[1.2vh]">
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">Comisión {estado.comisionNombre}</p>
          <h1 className="text-[clamp(2.2rem,4.6vw,5.5rem)] leading-[1.05] font-extrabold">{estado.quizTitulo}</h1>
          <p className="text-[clamp(1.2rem,2.2vw,2.8rem)] font-semibold">
            Entrá a <span className="font-extrabold text-acento tabular-nums">{direccion}</span>
          </p>
        </div>
        {info && (
          <div className="rounded-[1.6rem] bg-card p-[1vw] shadow-[var(--pd-sombra-flotante)]">
            <img src={info.qr} alt={`Código QR para entrar a ${info.url}`} className="size-[min(15vw,24vh)] [image-rendering:pixelated]" />
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[2vh] rounded-[2.5rem] bg-pd-celeste-claro/70 px-[3vw] py-[3vh]">
        <h2 className="text-[clamp(1.3rem,2.2vw,2.6rem)] font-bold">
          {estado.ranking.length === 0 ? (
            'Esperando que entren…'
          ) : (
            <>
              {/* El número salta con cada uno que entra. */}
              <motion.span
                key={estado.ranking.length}
                className="inline-block text-acento tabular-nums"
                initial={{ scale: 1.7, y: -6 }}
                animate={{ scale: 1, y: 0 }}
                transition={MOVIMIENTO.rebote}
              >
                {estado.ranking.length}
              </motion.span>{' '}
              adentro
            </>
          )}
        </h2>
        {estado.equipos ? (
          <div className="grid min-h-0 flex-1 gap-[1.4vw]" style={{ gridTemplateColumns: `repeat(${Math.min(estado.equipos.length, 3)}, minmax(0, 1fr))` }}>
            {estado.equipos
              .map((e) => e.equipo)
              .sort((a, b) => a - b)
              .map((i) => (
                <div
                  key={i}
                  className="flex min-h-0 flex-col gap-[1.2vh] overflow-hidden rounded-[1.6rem] bg-card p-[1vw]"
                  style={{ boxShadow: `inset 0 0.8vh 0 ${equipo(i).color}` }}
                >
                  <p className="flex items-center gap-[0.8vw] pt-[0.6vh] text-[clamp(1.1rem,1.8vw,2.2rem)] font-extrabold">
                    <MascotaEquipo indice={i} className="size-[clamp(2rem,3vw,3.4rem)] text-[clamp(2rem,3vw,3.4rem)]" />
                    {equipo(i).nombre}
                  </p>
                  <ul className="flex flex-wrap content-start gap-x-[1vw] gap-y-[1vh]">
                    <AnimatePresence mode="popLayout">
                      {estado.ranking
                        .filter((a) => a.equipo === i)
                        .map((a) => (
                          <motion.li
                            key={a.alumnoId}
                            layoutId={`sala-${a.alumnoId}`}
                            initial={{ opacity: 0, y: -90, scale: 0.5 }}
                            animate={{ opacity: a.conectado ? 1 : 0.4, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6, transition: MOVIMIENTO.salida }}
                            transition={MOVIMIENTO.rebote}
                            className="flex w-[clamp(4.5rem,6vw,8rem)] flex-col items-center gap-1 text-center"
                          >
                            <PinAvatar avatar={a.avatar} tamano={52} />
                            <span className="w-full truncate text-[clamp(0.85rem,1.1vw,1.4rem)] font-semibold">{cortos.get(a.alumnoId)}</span>
                          </motion.li>
                        ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
          </div>
        ) : (
          <ul className="flex flex-wrap content-start gap-x-[2vw] gap-y-[2vh] overflow-hidden">
            <AnimatePresence mode="popLayout">
              {estado.ranking.map((a) => (
                <motion.li
                  key={a.alumnoId}
                  layout
                  initial={{ opacity: 0, y: -120, scale: 0.5 }}
                  animate={{ opacity: a.conectado ? 1 : 0.4, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, transition: MOVIMIENTO.salida }}
                  transition={MOVIMIENTO.rebote}
                  className="flex w-[clamp(5.5rem,8vw,10rem)] flex-col items-center gap-2 text-center"
                >
                  <PinAvatar avatar={a.avatar} tamano={72} />
                  <span className="w-full truncate text-[clamp(0.95rem,1.3vw,1.6rem)] font-semibold">{cortos.get(a.alumnoId)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

// --- cuenta regresiva -----------------------------------------------------------------

/** Lo que cubre toda la pantalla desde adentro de una fase (compensa el margen del escenario). */
const TODA_LA_PANTALLA = 'pointer-events-none absolute -inset-x-[4vw] -top-[3vh] -bottom-[4vh]';
const PALABRA_CUENTA = ['', '¡Ya!', 'Listos…', 'Preparados…'];

function Cuenta({ estado, recibido }: { estado: EstadoJuego; recibido: number }) {
  const [n, setN] = useState(3);
  const sacudon = useAnimationControls();
  useEffect(() => {
    let previo = 0;
    const tick = () => {
      const v = Math.max(1, Math.ceil((3000 - (performance.now() - recibido)) / 1000));
      setN(v);
      if (v !== previo) sonidos.cuenta(v === 1);
      previo = v;
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [recibido]);
  // Cada número cae y sacude el escenario.
  useEffect(() => {
    void sacudon.start({ x: [0, -16, 13, -7, 0], y: [0, 8, -5, 2, 0], transition: { duration: 0.34, delay: 0.1 } });
  }, [n, sacudon]);

  return (
    <motion.div className="relative flex h-full flex-col items-center justify-center gap-[3vh]" animate={sacudon}>
      {/* El destello de cada golpe. */}
      <motion.span
        key={`destello-${n}`}
        aria-hidden
        className={cn(TODA_LA_PANTALLA, 'bg-white')}
        initial={{ opacity: 0.2 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <p className="text-[clamp(1.6rem,3vw,3.6rem)] font-bold text-muted-foreground">
        Pregunta {estado.indice + 1} de {estado.total}
      </p>
      <div className="relative grid size-[min(44vh,32vw)] place-items-center rounded-full bg-linear-to-br from-pd-celeste to-pd-celeste-oscuro shadow-[0_0_14vh_rgb(58_182_230/0.55)]">
        {/* Dos ondas que se expanden con cada número. */}
        {[0, 0.16].map((demora) => (
          <motion.span
            key={`anillo-${n}-${demora}`}
            aria-hidden
            className="absolute inset-0 rounded-full border-[0.7vh] border-pd-celeste"
            initial={{ scale: 1, opacity: 0.85 }}
            animate={{ scale: demora ? 2 : 1.5, opacity: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut', delay: demora }}
          />
        ))}
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            className="text-[min(30vh,22vw)] leading-none font-extrabold text-white [text-shadow:0_0.6vh_0_rgb(0_0_0/0.18)]"
            initial={{ scale: 3.2, opacity: 0, y: '-12vh' }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, transition: MOVIMIENTO.salida }}
            transition={MOVIMIENTO.impacto}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={n}
          className="text-[clamp(1.8rem,3.4vw,4rem)] font-extrabold"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: MOVIMIENTO.salida }}
          transition={MOVIMIENTO.rebote}
        >
          {PALABRA_CUENTA[n]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

// --- pregunta -----------------------------------------------------------------------

function Pregunta({ estado, recibido }: { estado: EstadoJuego; recibido: number }) {
  const restante = useRestante({ estado, recibido });
  const p = estado.pregunta;
  const segundos = Math.ceil(restante / 1000);
  const ultimo = useRef(segundos);
  useEffect(() => {
    if (segundos !== ultimo.current && segundos <= 5 && segundos > 0 && !estado.pausado) sonidos.tic();
    ultimo.current = segundos;
  }, [segundos, estado.pausado]);
  if (!p) return null;
  if (p.tipo === 'tipeo') return <CarreraEnPantalla estado={estado} restante={restante} />;
  const urgente = segundos <= 5 && restante > 0 && !estado.pausado;
  const todos = estado.conectados > 0 && estado.respondieron >= estado.conectados;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-[2.5vh]">
      {/* Últimos segundos: los bordes de la pantalla se encienden en rojo. */}
      <AnimatePresence>
        {urgente && (
          <motion.div aria-hidden className={TODA_LA_PANTALLA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="halo size-full shadow-[inset_0_0_16vh_rgb(242_95_92/0.6)]" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-start gap-[2vw]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1vh]">
          <p className="flex items-center gap-3 text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
            Pregunta {estado.indice + 1} de {estado.total}
            {p.multiplicador === 2 && <span className="rounded-full bg-pd-celeste-oscuro px-3 py-0.5 text-white">Puntos dobles</span>}
            {p.multiplicador === 0 && <span className="rounded-full bg-muted px-3 py-0.5">Sin puntos</span>}
            {p.tipo === 'varias' && <span className="rounded-full bg-pd-resp-c px-3 py-0.5 text-pd-gris-texto">¡Ojo! Hay más de una correcta</span>}
            {p.tipo === 'ordenar' && <span className="rounded-full bg-pd-celeste-claro px-3 py-0.5 text-foreground">Ordená los pasos en tu compu</span>}
          </p>
          <motion.h1
            className="text-[clamp(1.8rem,3.6vw,4.4rem)] leading-[1.1] font-extrabold text-pretty"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...MOVIMIENTO.suave, delay: 0.05 }}
          >
            {p.texto}
          </motion.h1>
        </div>
        <div className="flex flex-col items-center gap-[1vh]">
          <Temporizador restanteMs={restante} totalMs={estado.tiempoTotalMs} pausado={estado.pausado} tamano={Math.min(window.innerHeight * 0.2, 200)} />
          {/* El contador salta con cada respuesta que llega; cuando están todas, queda en verde. */}
          <p className={cn('text-[clamp(1rem,1.6vw,2rem)] font-bold tabular-nums', todos && 'text-bien-texto')}>
            <motion.span key={estado.respondieron} className="inline-block" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={MOVIMIENTO.rebote}>
              {estado.respondieron}
            </motion.span>
            /{estado.conectados} {todos ? '¡todos!' : 'respondieron'}
          </p>
        </div>
      </div>

      {p.imagen && (
        <div className="flex min-h-0 flex-1 justify-center">
          <img
            src={urlImagen(p.imagen)}
            alt=""
            className="h-full max-h-full min-h-0 w-auto max-w-full rounded-3xl object-contain shadow-[var(--pd-sombra-flotante)]"
          />
        </div>
      )}

      {p.tipo === 'ordenar' ? (
        <ul className={cn('grid grid-cols-2 gap-[1.4vh_1.4vw]', !p.imagen && 'flex-1 content-end')}>
          {p.opciones.map((o, i) => (
            <motion.li
              key={o.id}
              className="flex min-h-[9vh] items-center gap-[1vw] rounded-3xl bg-card px-[1.6vw] py-[1.6vh] text-[clamp(1.2rem,2.2vw,2.6rem)] font-bold shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5"
              initial={{ opacity: 0, y: 20, rotate: i % 2 ? 1.5 : -1.5 }}
              animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
              transition={{ ...MOVIMIENTO.rebote, delay: escalon(i) }}
            >
              <span className="text-muted-foreground">?</span>
              {o.texto}
            </motion.li>
          ))}
        </ul>
      ) : (
        <div className={cn('grid grid-cols-2 gap-[1.6vh_1.4vw]', !p.imagen && 'flex-1 content-end')}>
          {p.opciones.map((o, i) => (
            <motion.div
              key={o.id}
              className="grid"
              style={{ transformPerspective: 1200 }}
              initial={{ opacity: 0, y: 30, rotateX: -75 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ ...MOVIMIENTO.rebote, damping: 22, delay: escalon(i, 0.11, 0.3) }}
            >
              <BotonRespuesta tipo={p.tipo} indice={i} texto={o.texto} disabled tamano="xl" className="min-h-[11vh]" />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {estado.pausado && (
          <motion.div
            className="vidrio absolute inset-0 z-10 grid place-items-center rounded-[2.5rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-4">
              <Pause className="size-[12vh] text-acento" />
              <p className="text-[clamp(2rem,4vw,5rem)] font-extrabold">Pausa</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Carrera de tipeo en medio del quiz: la frase arriba y la pista con un carril por alumno. */
function CarreraEnPantalla({ estado, restante }: { estado: EstadoJuego; restante: number }) {
  const p = estado.pregunta!;
  const llegaron = estado.carrera?.filter((c) => c.terminado).length ?? 0;
  const previos = useRef(llegaron);
  useEffect(() => {
    if (llegaron > previos.current) sonidos.pop();
    previos.current = llegaron;
  }, [llegaron]);
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-[2.5vh]">
      <div className="flex items-start gap-[2vw]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1.2vh]">
          <p className="flex items-center gap-3 text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
            Pregunta {estado.indice + 1} de {estado.total}
            <span className="flex items-center gap-2 rounded-full bg-pd-celeste-oscuro px-3 py-0.5 text-white">
              <Keyboard className="size-[1.1em]" />
              Carrera de tipeo
            </span>
            {p.multiplicador === 2 && <span className="rounded-full bg-pd-celeste-oscuro px-3 py-0.5 text-white">Puntos dobles</span>}
          </p>
          <p className="rounded-3xl bg-card px-[1.6vw] py-[1.4vh] font-mono text-[clamp(1.2rem,2.2vw,2.8rem)] leading-snug font-semibold shadow-[var(--pd-sombra-tarjeta)]">
            {p.texto}
          </p>
        </div>
        <div className="flex flex-col items-center gap-[1vh]">
          <Temporizador restanteMs={restante} totalMs={estado.tiempoTotalMs} pausado={estado.pausado} tamano={Math.min(window.innerHeight * 0.18, 180)} />
          <p className="text-[clamp(1rem,1.6vw,2rem)] font-bold tabular-nums">
            {llegaron}/{estado.conectados} llegaron
          </p>
        </div>
      </div>
      <Carriles corredores={estado.carrera ?? []} largo={p.texto.length} maxAlto={52} />
      <AnimatePresence>
        {estado.pausado && (
          <motion.div
            className="vidrio absolute inset-0 z-10 grid place-items-center rounded-[2.5rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-4">
              <Pause className="size-[12vh] text-acento" />
              <p className="text-[clamp(2rem,4vw,5rem)] font-extrabold">Pausa</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- resultado ----------------------------------------------------------------------

/** Cuánto se sostiene el suspenso (las barras creciendo) antes de mostrar cuál era la correcta. */
const SUSPENSO_MS = 1300;

function Resultado({ estado }: { estado: EstadoJuego }) {
  useEffect(() => sonidos.gong(), []);
  const p = estado.pregunta;
  const [revelado, setRevelado] = useState(false);
  const correctas = useRef<Map<number, HTMLElement>>(new Map());
  const conSuspenso = p !== null && p.tipo !== 'ordenar' && p.tipo !== 'tipeo';
  useEffect(() => {
    if (!conSuspenso) return;
    const t = setTimeout(() => {
      setRevelado(true);
      sonidos.acierto();
      // El confetti sale de cada respuesta correcta.
      const cuantas = correctas.current.size;
      correctas.current.forEach((el) => estallido(el, Math.round(100 / Math.max(1, cuantas)) + 20));
    }, SUSPENSO_MS);
    return () => clearTimeout(t);
  }, [conSuspenso]);
  if (!p) return null;
  const dist = estado.distribucion ?? p.opciones.map(() => 0);
  const max = Math.max(1, ...dist);
  const iCorrecta = p.opciones.findIndex((o) => o.correcta);
  const acertaron = estado.correctas ?? dist[iCorrecta] ?? 0;
  const total = estado.ranking.length || estado.conectados;
  if (p.tipo === 'ordenar') return <ResultadoOrdenar estado={estado} acertaron={acertaron} total={total} />;
  if (p.tipo === 'tipeo') return <ResultadoTipeo estado={estado} llegaron={acertaron} total={total} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex flex-col gap-[1vh]">
        <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
          Pregunta {estado.indice + 1} de {estado.total}
        </p>
        <h1 className="text-[clamp(1.6rem,3vw,3.6rem)] leading-[1.1] font-extrabold text-pretty">{p.texto}</h1>
        {/* Ocupa su lugar desde el principio (no mueve nada al aparecer) y entra con el revelado. */}
        <motion.p
          className="origin-left text-[clamp(1.2rem,2.2vw,2.8rem)] font-bold text-acento"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={revelado ? { opacity: 1, scale: 1 } : {}}
          transition={MOVIMIENTO.rebote}
        >
          {acertaron === 0 ? 'Nadie la acertó' : acertaron === 1 ? 'La acertó 1' : `La acertaron ${acertaron}`}
          {total > 0 && ` de ${total}`}
        </motion.p>
      </div>

      {/* Barras con la cantidad de respuestas por opción */}
      <div className="flex min-h-0 flex-1 items-end justify-center gap-[3vw] px-[4vw]">
        {p.opciones.map((o, i) => {
          const e = estiloRespuesta(p.tipo, i);
          const correcta = o.correcta === true;
          return (
            <div key={o.id} className="flex h-full max-w-[16vw] flex-1 flex-col items-center justify-end gap-[1vh]">
              <motion.span
                className="flex items-center gap-[0.6vw] text-[clamp(1.6rem,3vw,3.6rem)] font-extrabold"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: revelado && !correcta ? 0.45 : 1, y: 0 }}
                transition={{ ...MOVIMIENTO.suave, delay: revelado ? 0 : escalon(i, 0.1, 0.4) }}
              >
                <FormaRespuesta forma={e.forma} color={e.fondo} className="size-[clamp(1.4rem,2.2vw,2.6rem)]" />
                <Numero valor={dist[i] ?? 0} desde={0} duracion={0.9} />
              </motion.span>
              {/* Se escala en Y (solo transform): animar la altura recalcula el layout en cada cuadro. */}
              <motion.div
                className="w-full origin-bottom rounded-t-3xl"
                style={{
                  backgroundColor: e.fondo,
                  height: `${4 + (dist[i]! / max) * 46}vh`,
                  boxShadow: revelado && correcta ? `0 0 6vh ${e.fondo}` : undefined,
                }}
                initial={{ scaleY: 0.03 }}
                animate={{ scaleY: 1, opacity: revelado && !correcta ? 0.25 : 1 }}
                transition={{ ...MOVIMIENTO.crecer, delay: revelado ? 0 : escalon(i, 0.1, 0.15) }}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-[1.4vh_1.4vw]">
        {p.opciones.map((o, i) => {
          const gano = revelado && o.correcta === true;
          return (
            // Después del suspenso, las incorrectas se apagan y la correcta salta y queda iluminada.
            <motion.div
              key={o.id}
              ref={(el) => {
                if (el && o.correcta) correctas.current.set(o.id, el);
                else correctas.current.delete(o.id);
              }}
              className={cn(
                'grid rounded-3xl transition-shadow duration-300',
                gano && 'z-10 shadow-[0_0_0_0.5vh_rgb(255_255_255/0.95),0_0_7vh_rgb(255_255_255/0.5)]',
              )}
              animate={gano ? { scale: [1, 1.09, 1.03] } : { scale: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            >
              <BotonRespuesta
                tipo={p.tipo}
                indice={i}
                texto={o.texto}
                disabled
                apagado={revelado && !o.correcta}
                tamano="lg"
                marca={
                  gano ? (
                    <motion.span
                      className="grid size-[clamp(2rem,3vw,3.4rem)] shrink-0 place-items-center rounded-full bg-white/30"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={MOVIMIENTO.rebote}
                    >
                      <Check className="size-[70%]" strokeWidth={3.5} />
                    </motion.span>
                  ) : undefined
                }
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Carrera de tipeo: quiénes llegaron primero, con su velocidad. */
function ResultadoTipeo({ estado, llegaron, total }: { estado: EstadoJuego; llegaron: number; total: number }) {
  const p = estado.pregunta!;
  const filas = (estado.carrera ?? []).filter((c) => c.posicion > 0).slice(0, 8);
  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex flex-col gap-[1vh]">
        <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
          Pregunta {estado.indice + 1} de {estado.total}: carrera de tipeo
        </p>
        <h1 className="text-[clamp(2rem,4vw,4.6rem)] leading-[1.05] font-extrabold">
          {llegaron === 0 ? 'Nadie llegó a la meta' : llegaron === 1 ? 'Llegó 1 a la meta' : `Llegaron ${llegaron} a la meta`}
          {total > 0 && <span className="text-muted-foreground"> de {total}</span>}
        </h1>
        <p className="truncate font-mono text-[clamp(1rem,1.6vw,2rem)] text-muted-foreground">{p.texto}</p>
      </div>
      {filas.length === 0 ? (
        <p className="m-auto text-[clamp(1.4rem,2.4vw,3rem)] font-semibold text-muted-foreground">Nadie llegó a tipear.</p>
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col justify-center gap-[1.2vh]">
          {filas.map((c, i) => (
            <motion.li
              key={c.alumnoId}
              className={cn(
                'flex items-center gap-[1.4vw] rounded-full py-[0.9vh] pr-[2vw] pl-[1vw] shadow-[var(--pd-sombra-tarjeta)]',
                i === 0 && c.terminado ? 'bg-pd-celeste-oscuro text-white' : 'bg-card',
              )}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...MOVIMIENTO.suave, delay: escalon(filas.length - 1 - i, 0.12, 0.2) }}
            >
              <span className="w-[4vw] text-right text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold tabular-nums">{ordinal(c.puesto)}</span>
              <PinAvatar avatar={c.avatar} tamano={Math.round(Math.min(56, window.innerHeight * 0.06))} />
              <span className="min-w-0 flex-1 truncate text-[clamp(1.2rem,2.2vw,2.6rem)] font-bold">
                {c.nombre} {c.terminado && <span aria-label="llegó">🏁</span>}
              </span>
              <span className="text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold tabular-nums">{c.ppm}</span>
              <span className="text-[clamp(0.9rem,1.4vw,1.7rem)] font-semibold opacity-75">ppm, {c.precision}%</span>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Ordenar: el orden correcto, paso por paso, con cuántos lo pusieron en su lugar. */
function ResultadoOrdenar({ estado, acertaron, total }: { estado: EstadoJuego; acertaron: number; total: number }) {
  const p = estado.pregunta!;
  const orden = (p.ordenCorrecto ?? p.opciones.map((o) => o.id)).map((id) => p.opciones.find((o) => o.id === id)!);
  const dist = estado.distribucion ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex flex-col gap-[1vh]">
        <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
          Pregunta {estado.indice + 1} de {estado.total}
        </p>
        <h1 className="text-[clamp(1.6rem,3vw,3.6rem)] leading-[1.1] font-extrabold text-pretty">{p.texto}</h1>
        <p className="text-[clamp(1.2rem,2.2vw,2.8rem)] font-bold text-acento">
          {acertaron === 0 ? 'Nadie lo ordenó bien' : acertaron === 1 ? 'Lo ordenó bien 1' : `Lo ordenaron bien ${acertaron}`}
          {total > 0 && ` de ${total}`}
        </p>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col justify-center gap-[1.4vh]">
        {orden.map((o, i) => {
          const enSuLugar = dist[p.opciones.findIndex((x) => x.id === o.id)] ?? 0;
          return (
            <motion.li
              key={o.id}
              className="flex items-center gap-[1.4vw] rounded-full bg-card py-[1.2vh] pr-[2vw] pl-[1vw] shadow-[var(--pd-sombra-tarjeta)]"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...MOVIMIENTO.suave, delay: escalon(i, 0.12, 0.15) }}
            >
              <span className="grid size-[clamp(2.4rem,4vw,4.6rem)] shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[clamp(1.2rem,2.4vw,2.8rem)] font-bold">{o.texto}</span>
              <span className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground tabular-nums">{enSuLugar} en su lugar</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

// --- ranking ------------------------------------------------------------------------

/** Cuánto se queda el ranking en el orden de antes, para que se vea quién pasa a quién. */
const ESPERA_REORDEN_MS = 900;

function Ranking({ estado }: { estado: EstadoJuego }) {
  if (estado.equipos) return <RankingEquipos estado={estado} equipos={estado.equipos} />;
  const top3 = estado.modoRanking === 'top3';
  const cantidad = top3 ? 3 : 10;
  const ultima = estado.indice + 1 >= estado.total;
  // Primero se ve el orden que había antes de esta pregunta; después las filas se acomodan
  // moviéndose a su lugar nuevo mientras suben los puntos.
  const [reordenado, setReordenado] = useState(false);
  const antes = [...estado.ranking].sort((a, b) => b.puntos - b.delta - (a.puntos - a.delta) || a.nombre.localeCompare(b.nombre, 'es'));
  const huboCambios = antes.slice(0, cantidad).some((r, i) => estado.ranking[i]?.alumnoId !== r.alumnoId);
  const cambios = useRef(huboCambios);
  cambios.current = huboCambios;
  useEffect(() => {
    const t = setTimeout(() => {
      setReordenado(true);
      if (cambios.current) sonidos.adelanto();
    }, ESPERA_REORDEN_MS);
    return () => clearTimeout(t);
  }, []);
  const filas = (reordenado ? estado.ranking : antes).slice(0, cantidad);
  const texto = top3 ? 'text-[clamp(1.8rem,3.4vw,4rem)]' : 'text-[clamp(1.1rem,min(2vw,3.4vh),2.4rem)]';

  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[clamp(2.2rem,4.4vw,5.2rem)] leading-none font-extrabold">{top3 ? 'Los 3 de arriba' : 'Ranking'}</h1>
        <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">
          {ultima ? 'Falta el podio' : `Después de la pregunta ${estado.indice + 1} de ${estado.total}`}
        </p>
      </div>
      <ol className={cn('flex min-h-0 flex-1 flex-col', top3 ? 'justify-center gap-[3vh]' : 'gap-[0.9vh]')}>
        <AnimatePresence mode="popLayout" initial={false}>
          {filas.map((r, i) => {
            // Cuántos puestos subió con esta pregunta (0 si quedó igual o bajó).
            const subidos = reordenado ? Math.max(0, antes.findIndex((x) => x.alumnoId === r.alumnoId) - i) : 0;
            const subio = subidos > 0;
            const lider = reordenado && r.puesto === 1;
            return (
              <motion.li
                key={r.alumnoId}
                layout="position"
                className={cn(
                  'relative flex items-center gap-[1.6vw] rounded-full bg-card pr-[2.4vw] shadow-[var(--pd-sombra-tarjeta)] transition-shadow duration-500',
                  top3 ? 'py-[1.6vh] pl-[1.6vw]' : 'py-[0.4vh] pl-[1vw]',
                  // El primero, en dorado; el que sube deja una estela verde.
                  lider && 'shadow-[0_0_5vh_rgb(245_183_0/0.4)] ring-4 ring-pd-resp-c',
                  subio && 'z-10 bg-[linear-gradient(90deg,var(--card)_35%,color-mix(in_oklch,var(--pd-bien-texto)_26%,var(--card)))]',
                )}
                initial={{ opacity: 0, x: -60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60, transition: MOVIMIENTO.salida }}
                transition={{ ...MOVIMIENTO.suave, delay: reordenado ? 0 : escalon(i, 0.07), layout: { ...MOVIMIENTO.suave, stiffness: 180 } }}
              >
                <span className={cn('w-[4vw] text-right font-extrabold text-muted-foreground tabular-nums', texto)}>
                  {reordenado ? ordinal(r.puesto) : `${i + 1}.º`}
                </span>
                <span className="relative">
                  <PinAvatar avatar={r.avatar} tamano={top3 ? 64 : 32} />
                  {lider && (
                    <motion.span
                      aria-hidden
                      className={cn('absolute left-1/2 leading-none', top3 ? '-top-[55%] text-[2.6rem]' : '-top-[60%] text-[1.4rem]')}
                      initial={{ opacity: 0, x: '-50%', y: -40, rotate: -30 }}
                      animate={{ opacity: 1, x: '-50%', y: 0, rotate: -8 }}
                      transition={{ ...MOVIMIENTO.impacto, delay: 0.35 }}
                    >
                      👑
                    </motion.span>
                  )}
                </span>
                <span className={cn('min-w-0 flex-1 truncate font-bold', texto)}>{r.nombre}</span>
                {subio && (
                  <motion.span
                    className="text-[clamp(1rem,1.6vw,2rem)] font-extrabold text-bien-texto"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={MOVIMIENTO.rebote}
                    aria-label={subidos === 1 ? 'Subió 1 puesto' : `Subió ${subidos} puestos`}
                  >
                    ▲{subidos}
                  </motion.span>
                )}
                {r.racha >= 2 && (
                  <span className="flex items-center gap-[0.3vw] text-[clamp(1rem,1.6vw,2rem)] font-bold">
                    <span className="latido inline-block" aria-hidden>
                      🔥
                    </span>
                    {r.racha}
                  </span>
                )}
                {/* Los puntos de esta pregunta llegan volando cuando se acomoda el ranking. */}
                {r.delta > 0 && (
                  <motion.span
                    className="rounded-full bg-pd-celeste-claro px-3 py-0.5 text-[clamp(1rem,1.5vw,1.8rem)] font-bold text-acento tabular-nums"
                    initial={{ opacity: 0, x: 60, scale: 0.5 }}
                    animate={reordenado ? { opacity: 1, x: 0, scale: 1 } : {}}
                    transition={{ ...MOVIMIENTO.rebote, delay: escalon(i, 0.04, 0) }}
                  >
                    +{formatoPuntos(r.delta)}
                  </motion.span>
                )}
                <Numero valor={reordenado ? r.puntos : r.puntos - r.delta} className={cn('w-[12vw] text-right font-extrabold', texto)} />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {!top3 && estado.ranking.length > filas.length && (
        <p className="text-center text-[clamp(1rem,1.4vw,1.8rem)] text-muted-foreground">y {estado.ranking.length - filas.length} más</p>
      )}
    </div>
  );
}

/** Ranking por equipos: una columna por equipo que crece con el promedio, y quién va primero en cada uno. */
function RankingEquipos({ estado, equipos }: { estado: EstadoJuego; equipos: FilaEquipo[] }) {
  const ultima = estado.indice + 1 >= estado.total;
  const max = Math.max(1, ...equipos.map((e) => e.puntos));
  // Las columnas quedan siempre en el mismo orden (por equipo): lo que cambia es la altura y el puesto.
  const columnas = [...equipos].sort((a, b) => a.equipo - b.equipo);
  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[clamp(2.2rem,4.4vw,5.2rem)] leading-none font-extrabold">Equipos</h1>
        <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">
          {ultima ? 'Falta el podio' : `Después de la pregunta ${estado.indice + 1} de ${estado.total}`}. Puntos: promedio por integrante
        </p>
      </div>
      <div className="flex min-h-0 flex-1 items-end justify-center gap-[2.4vw] px-[2vw]">
        {columnas.map((f, i) => {
          const e = equipo(f.equipo);
          const mejor = estado.ranking.find((r) => r.equipo === f.equipo);
          return (
            <div key={f.equipo} className="flex h-full max-w-[18vw] flex-1 flex-col items-center justify-end gap-[1vh]">
              <motion.span
                className={cn('text-[clamp(1.6rem,3vw,3.6rem)] font-extrabold', f.puesto === 1 && 'text-acento')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MOVIMIENTO.suave, delay: escalon(i, 0.08, 0.6) }}
              >
                {ordinal(f.puesto)}
              </motion.span>
              <span className="text-[clamp(1.4rem,2.6vw,3.2rem)] font-extrabold">
                <Numero valor={f.puntos} desde={f.puntos - f.delta} duracion={1.4} />
              </span>
              {f.delta > 0 && (
                <span className="rounded-full bg-pd-celeste-claro px-3 py-0.5 text-[clamp(0.9rem,1.4vw,1.7rem)] font-bold text-acento tabular-nums">
                  +{formatoPuntos(f.delta)}
                </span>
              )}
              <div className="relative w-full" style={{ height: `${8 + (f.puntos / max) * 40}vh` }}>
                <motion.div
                  className="absolute inset-0 origin-bottom rounded-t-[2rem]"
                  style={{ backgroundColor: e.color }}
                  initial={{ scaleY: (8 + ((f.puntos - f.delta) / max) * 40) / (8 + (f.puntos / max) * 40) }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...MOVIMIENTO.crecer, delay: escalon(i, 0.08, 0.2) }}
                />
                <motion.span
                  className="absolute inset-x-0 top-[1.4vh] text-center text-[clamp(2.2rem,4vw,4.6rem)] leading-none"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...MOVIMIENTO.rebote, delay: escalon(i, 0.08, 0.3) }}
                  aria-hidden
                >
                  {e.mascota}
                </motion.span>
              </div>
              <div className="flex w-full flex-col items-center gap-[0.4vh] text-center">
                <span className="text-[clamp(1.1rem,1.9vw,2.4rem)] font-extrabold">{e.nombre}</span>
                {mejor && (
                  <span className="flex max-w-full items-center gap-[0.4vw] text-[clamp(0.85rem,1.2vw,1.5rem)] font-semibold text-muted-foreground">
                    <PinAvatar avatar={mejor.avatar} tamano={24} />
                    <span className="truncate">{mejor.nombre}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

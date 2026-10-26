import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Pause } from 'lucide-react';
import type { EstadoJuego, InfoServidor } from '@aula/shared';
import { Numero } from '@/components/pd/Numero';
import { PinAvatar } from '@/components/pd/Pin';
import { BotonRespuesta, estiloRespuesta, FormaRespuesta } from '@/components/pd/Respuesta';
import { Temporizador } from '@/components/pd/Temporizador';
import { formatoPuntos, ordinal, urlImagen, useRestante } from '@/lib/juego';
import { sonidos } from '@/lib/sonidos';
import { nombresCortos } from '@/lib/nombres';
import { cn } from '@/lib/utils';
import { Podio } from './Podio';

interface Props {
  estado: EstadoJuego;
  recibido: number;
  info: InfoServidor | null;
}

export function JuegoPantalla({ estado, recibido, info }: Props) {
  const clave = `${estado.fase}-${estado.indice}`;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={clave}
        className="flex h-full min-h-0 flex-col"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
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
            Entrá a <span className="font-extrabold text-pd-celeste-oscuro tabular-nums">{direccion}</span>
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
          {estado.ranking.length === 0 ? 'Esperando que entren…' : `${estado.ranking.length} adentro`}
        </h2>
        <ul className="flex flex-wrap content-start gap-x-[2vw] gap-y-[2vh] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {estado.ranking.map((a) => (
              <motion.li
                key={a.alumnoId}
                layout
                initial={{ opacity: 0, y: 40, scale: 0.5 }}
                animate={{ opacity: a.conectado ? 1 : 0.4, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="flex w-[clamp(5.5rem,8vw,10rem)] flex-col items-center gap-2 text-center"
              >
                <PinAvatar avatar={a.avatar} tamano={72} />
                <span className="w-full truncate text-[clamp(0.95rem,1.3vw,1.6rem)] font-semibold">{cortos.get(a.alumnoId)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

// --- cuenta regresiva -----------------------------------------------------------------

function Cuenta({ estado, recibido }: { estado: EstadoJuego; recibido: number }) {
  const [n, setN] = useState(3);
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
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[3vh]">
      <p className="text-[clamp(1.6rem,3vw,3.6rem)] font-bold text-muted-foreground">
        Pregunta {estado.indice + 1} de {estado.total}
      </p>
      <div className="relative grid size-[min(40vh,30vw)] place-items-center rounded-full bg-pd-celeste-oscuro shadow-[var(--pd-sombra-flotante)]">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            className="text-[min(26vh,20vw)] leading-none font-extrabold text-white"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
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

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-[2.5vh]">
      <div className="flex items-start gap-[2vw]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1vh]">
          <p className="flex items-center gap-3 text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
            Pregunta {estado.indice + 1} de {estado.total}
            {p.multiplicador === 2 && <span className="rounded-full bg-pd-celeste-oscuro px-3 py-0.5 text-white">Puntos dobles</span>}
            {p.multiplicador === 0 && <span className="rounded-full bg-muted px-3 py-0.5">Sin puntos</span>}
            {p.tipo === 'varias' && <span className="rounded-full bg-pd-resp-c px-3 py-0.5 text-pd-gris-texto">¡Ojo! Hay más de una correcta</span>}
            {p.tipo === 'ordenar' && <span className="rounded-full bg-pd-celeste-claro px-3 py-0.5 text-foreground">Ordená los pasos en tu compu</span>}
          </p>
          <h1 className="text-[clamp(1.8rem,3.6vw,4.4rem)] leading-[1.1] font-extrabold text-pretty">{p.texto}</h1>
        </div>
        <div className="flex flex-col items-center gap-[1vh]">
          <Temporizador restanteMs={restante} totalMs={estado.tiempoTotalMs} pausado={estado.pausado} tamano={Math.min(window.innerHeight * 0.2, 200)} />
          <p className="text-[clamp(1rem,1.6vw,2rem)] font-bold tabular-nums">
            {estado.respondieron}/{estado.conectados} respondieron
          </p>
        </div>
      </div>

      {p.imagen && (
        <div className="flex min-h-0 flex-1 justify-center">
          <img src={urlImagen(p.imagen)} alt="" className="h-full max-h-full min-h-0 w-auto max-w-full rounded-3xl object-contain shadow-[var(--pd-sombra-flotante)]" />
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
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.06 }}
            >
              <span className="text-muted-foreground">?</span>
              {o.texto}
            </motion.li>
          ))}
        </ul>
      ) : (
        <div className={cn('grid grid-cols-2 gap-[1.6vh_1.4vw]', !p.imagen && 'flex-1 content-end')}>
          {p.opciones.map((o, i) => (
            <BotonRespuesta key={o.id} tipo={p.tipo} indice={i} texto={o.texto} disabled tamano="xl" className="min-h-[11vh]" />
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
              <Pause className="size-[12vh] text-pd-celeste-oscuro" />
              <p className="text-[clamp(2rem,4vw,5rem)] font-extrabold">Pausa</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- resultado ----------------------------------------------------------------------

function Resultado({ estado }: { estado: EstadoJuego }) {
  useEffect(() => sonidos.gong(), []);
  const p = estado.pregunta;
  if (!p) return null;
  const dist = estado.distribucion ?? p.opciones.map(() => 0);
  const max = Math.max(1, ...dist);
  const iCorrecta = p.opciones.findIndex((o) => o.correcta);
  const acertaron = estado.correctas ?? dist[iCorrecta] ?? 0;
  const total = estado.ranking.length || estado.conectados;
  if (p.tipo === 'ordenar') return <ResultadoOrdenar estado={estado} acertaron={acertaron} total={total} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex flex-col gap-[1vh]">
        <p className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground">
          Pregunta {estado.indice + 1} de {estado.total}
        </p>
        <h1 className="text-[clamp(1.6rem,3vw,3.6rem)] leading-[1.1] font-extrabold text-pretty">{p.texto}</h1>
        <p className="text-[clamp(1.2rem,2.2vw,2.8rem)] font-bold text-pd-celeste-oscuro">
          {acertaron === 0 ? 'Nadie la acertó' : acertaron === 1 ? 'La acertó 1' : `La acertaron ${acertaron}`}
          {total > 0 && ` de ${total}`}
        </p>
      </div>

      {/* Barras con la cantidad de respuestas por opción */}
      <div className="flex min-h-0 flex-1 items-end justify-center gap-[3vw] px-[4vw]">
        {p.opciones.map((o, i) => {
          const e = estiloRespuesta(p.tipo, i);
          const correcta = o.correcta === true;
          return (
            <div key={o.id} className="flex h-full max-w-[16vw] flex-1 flex-col items-center justify-end gap-[1vh]">
              <span className="text-[clamp(1.6rem,3vw,3.6rem)] font-extrabold tabular-nums">{dist[i]}</span>
              <motion.div
                className="flex w-full items-start justify-center rounded-t-3xl pt-[1.2vh]"
                style={{ backgroundColor: e.fondo, opacity: correcta ? 1 : 0.35 }}
                initial={{ height: '1.5vh' }}
                animate={{ height: `${4 + (dist[i]! / max) * 46}vh` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.15 + i * 0.08 }}
              >
                <FormaRespuesta forma={e.forma} color={e.texto} className="size-[clamp(1.6rem,2.6vw,3rem)]" />
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-[1.4vh_1.4vw]">
        {p.opciones.map((o, i) => (
          <BotonRespuesta
            key={o.id}
            tipo={p.tipo}
            indice={i}
            texto={o.texto}
            disabled
            apagado={!o.correcta}
            tamano="lg"
            marca={
              o.correcta ? (
                <span className="grid size-[clamp(2rem,3vw,3.4rem)] shrink-0 place-items-center rounded-full bg-white/30">
                  <Check className="size-[70%]" strokeWidth={3.5} />
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
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
        <p className="text-[clamp(1.2rem,2.2vw,2.8rem)] font-bold text-pd-celeste-oscuro">
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
              transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.15 + i * 0.12 }}
            >
              <span className="grid size-[clamp(2.4rem,4vw,4.6rem)] shrink-0 place-items-center rounded-full bg-pd-celeste-oscuro text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[clamp(1.2rem,2.4vw,2.8rem)] font-bold">{o.texto}</span>
              <span className="text-[clamp(1rem,1.6vw,2rem)] font-semibold text-muted-foreground tabular-nums">
                {enSuLugar} en su lugar
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

// --- ranking ------------------------------------------------------------------------

function Ranking({ estado }: { estado: EstadoJuego }) {
  const top3 = estado.modoRanking === 'top3';
  const filas = estado.ranking.slice(0, top3 ? 3 : 10);
  const ultima = estado.indice + 1 >= estado.total;
  return (
    <div className="flex h-full min-h-0 flex-col gap-[3vh]">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[clamp(2.2rem,4.4vw,5.2rem)] leading-none font-extrabold">{top3 ? 'Los 3 de arriba' : 'Ranking'}</h1>
        <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-muted-foreground">
          {ultima ? 'Falta el podio' : `Después de la pregunta ${estado.indice + 1} de ${estado.total}`}
        </p>
      </div>
      <ol className={cn('flex min-h-0 flex-1 flex-col', top3 ? 'justify-center gap-[3vh]' : 'gap-[1.2vh]')}>
        {filas.map((r, i) => (
          <motion.li
            key={r.alumnoId}
            className={cn(
              'flex items-center gap-[1.6vw] rounded-full bg-card pr-[2.4vw] shadow-[var(--pd-sombra-tarjeta)]',
              top3 ? 'py-[1.6vh] pl-[1.6vw]' : 'py-[0.7vh] pl-[1vw]',
              r.puesto === 1 && 'ring-4 ring-pd-celeste',
            )}
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 + i * 0.07 }}
          >
            <span className={cn('w-[4vw] text-right font-extrabold text-muted-foreground tabular-nums', top3 ? 'text-[clamp(1.8rem,3.4vw,4rem)]' : 'text-[clamp(1.2rem,2vw,2.4rem)]')}>
              {ordinal(r.puesto)}
            </span>
            <PinAvatar avatar={r.avatar} tamano={top3 ? 64 : 38} />
            <span className={cn('min-w-0 flex-1 truncate font-bold', top3 ? 'text-[clamp(1.8rem,3.4vw,4rem)]' : 'text-[clamp(1.2rem,2vw,2.4rem)]')}>{r.nombre}</span>
            {r.racha >= 2 && <span className="text-[clamp(1rem,1.6vw,2rem)] font-bold">🔥 {r.racha}</span>}
            {r.delta > 0 && (
              <span className="rounded-full bg-pd-celeste-claro px-3 py-0.5 text-[clamp(1rem,1.5vw,1.8rem)] font-bold text-pd-celeste-oscuro tabular-nums">
                +{formatoPuntos(r.delta)}
              </span>
            )}
            <Numero
              valor={r.puntos}
              desde={r.puntos - r.delta}
              className={cn('w-[12vw] text-right font-extrabold', top3 ? 'text-[clamp(1.8rem,3.4vw,4rem)]' : 'text-[clamp(1.2rem,2vw,2.4rem)]')}
            />
          </motion.li>
        ))}
      </ol>
      {!top3 && estado.ranking.length > filas.length && (
        <p className="text-center text-[clamp(1rem,1.4vw,1.8rem)] text-muted-foreground">y {estado.ranking.length - filas.length} más</p>
      )}
    </div>
  );
}

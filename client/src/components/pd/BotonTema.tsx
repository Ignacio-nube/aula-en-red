import { motion } from 'motion/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MOVIMIENTO } from '@/lib/movimiento';
import { cambiarTemaDesde, useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';

const MEDIDAS = { md: { ancho: 60, alto: 32 }, lg: { ancho: 74, alto: 40 } } as const;

/** Estrellitas del cielo de noche: posición (en % de la pastilla) y tamaño en px. */
const ESTRELLAS = [
  { x: 16, y: 26, t: 2.5 },
  { x: 30, y: 62, t: 2 },
  { x: 42, y: 30, t: 1.5 },
  { x: 24, y: 80, t: 1.5 },
  { x: 50, y: 70, t: 2 },
];

/**
 * Interruptor de claro a oscuro: un cielo donde el sol se desliza y se vuelve luna. Queda guardado
 * en esta compu. Mientras nadie lo toque, sigue al sistema operativo.
 */
export function BotonTema({ tamano = 'md', className }: { tamano?: keyof typeof MEDIDAS; className?: string }) {
  const { oscuro } = useTema();
  const { ancho, alto } = MEDIDAS[tamano];
  const margen = 3;
  const perilla = alto - margen * 2;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={oscuro}
          aria-label="Modo oscuro"
          onClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            cambiarTemaDesde(oscuro ? 'claro' : 'oscuro', r.left + r.width / 2, r.top + r.height / 2);
          }}
          className={cn(
            'relative shrink-0 cursor-pointer overflow-hidden rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.2),0_4px_10px_-4px_rgb(0_0_0/0.35)] ring-2 ring-white/70 outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/60 active:scale-95 dark:ring-white/25',
            className,
          )}
          style={{ width: ancho, height: alto }}
        >
          {/* Cielo de día y, encima, el de noche que aparece. */}
          <span className="absolute inset-0 bg-linear-to-b from-[#3aa9e0] to-[#9ddcf6]" aria-hidden />
          <motion.span
            className="absolute inset-0 bg-linear-to-b from-[#0a1230] to-[#2b3270]"
            initial={false}
            animate={{ opacity: oscuro ? 1 : 0 }}
            transition={{ duration: 0.35 }}
            aria-hidden
          />
          {/* Nubes: se van hacia abajo cuando llega la noche. */}
          <motion.span
            className="absolute inset-0"
            initial={false}
            animate={{ y: oscuro ? alto : 0, opacity: oscuro ? 0 : 1 }}
            transition={MOVIMIENTO.suave}
            aria-hidden
          >
            <span className="absolute rounded-full bg-white" style={{ width: alto * 0.5, height: alto * 0.5, right: alto * 0.42, bottom: -alto * 0.14 }} />
            <span className="absolute rounded-full bg-white" style={{ width: alto * 0.66, height: alto * 0.66, right: -alto * 0.06, bottom: -alto * 0.3 }} />
            <span className="absolute rounded-full bg-white/70" style={{ width: alto * 0.4, height: alto * 0.4, right: alto * 0.8, bottom: -alto * 0.22 }} />
          </motion.span>
          {/* Estrellas: bajan desde arriba. */}
          <motion.span
            className="absolute inset-0"
            initial={false}
            animate={{ y: oscuro ? 0 : -alto, opacity: oscuro ? 1 : 0 }}
            transition={MOVIMIENTO.suave}
            aria-hidden
          >
            {ESTRELLAS.map((e, i) => (
              <span key={i} className="absolute rounded-full bg-white" style={{ left: `${e.x}%`, top: `${e.y}%`, width: e.t, height: e.t }} />
            ))}
          </motion.span>
          {/* La perilla: sol de día, luna (con cráteres) de noche. */}
          <motion.span
            className="absolute rounded-full"
            style={{ width: perilla, height: perilla, top: margen, left: margen }}
            initial={false}
            animate={{
              x: oscuro ? ancho - alto : 0,
              backgroundColor: oscuro ? '#e6eaf4' : '#ffd43b',
              boxShadow: oscuro
                ? '0 0 8px 1px rgb(230 234 244 / 0.55), inset -2px -2px 0 rgb(0 0 0 / 0.08)'
                : '0 0 10px 2px rgb(255 212 59 / 0.75), inset -2px -2px 0 rgb(240 150 0 / 0.35)',
            }}
            transition={MOVIMIENTO.rapido}
            aria-hidden
          >
            <motion.span className="absolute inset-0" initial={false} animate={{ opacity: oscuro ? 1 : 0 }} transition={{ duration: 0.25 }}>
              <span className="absolute rounded-full bg-[#b9c0d4]" style={{ width: '30%', height: '30%', left: '18%', top: '22%' }} />
              <span className="absolute rounded-full bg-[#b9c0d4]" style={{ width: '20%', height: '20%', left: '58%', top: '50%' }} />
              <span className="absolute rounded-full bg-[#b9c0d4]" style={{ width: '14%', height: '14%', left: '32%', top: '66%' }} />
            </motion.span>
          </motion.span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{oscuro ? 'Modo oscuro: tocá para pasar a claro' : 'Modo claro: tocá para pasar a oscuro'}</TooltipContent>
    </Tooltip>
  );
}

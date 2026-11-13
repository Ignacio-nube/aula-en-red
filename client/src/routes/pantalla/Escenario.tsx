import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { FaseJuego } from '@aula/shared';

/** El color de la tercera luz, según lo que esté pasando: celeste al jugar, verde al revelar, dorado al premiar. */
const TONO: Record<FaseJuego, string> = {
  lobby: '58 182 230',
  cuenta: '242 95 92',
  pregunta: '58 182 230',
  resultado: '43 182 115',
  ranking: '245 183 0',
  podio: '245 183 0',
};
const TONOS = [...new Set(Object.values(TONO))];

const mancha = (color: string, opacidad: number) => `radial-gradient(closest-side, rgb(${color} / ${opacidad}), transparent)`;

/**
 * El escenario del quiz en la pantalla grande: siempre oscuro (aunque la compu esté en tema claro), con
 * luces de colores que se mueven despacio y dos reflectores. Todo se mueve solo con transform y opacity;
 * en modo liviano queda quieto.
 */
export function Escenario({ fase, children }: { fase: FaseJuego; children: ReactNode }) {
  return (
    <motion.div className="dark escenario absolute inset-0 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className="mancha absolute -top-[30vmax] -left-[20vmax] size-[80vmax] rounded-full"
          style={{ background: mancha('58 182 230', 0.3), animation: 'deriva-a 19s ease-in-out infinite' }}
        />
        <span
          className="mancha absolute -right-[25vmax] -bottom-[35vmax] size-[85vmax] rounded-full"
          style={{ background: mancha('124 92 230', 0.3), animation: 'deriva-b 24s ease-in-out infinite' }}
        />
        {/* La luz que cambia de color con la fase: una capa por color, y se funde la que toca. */}
        {TONOS.map((color) => (
          <motion.span
            key={color}
            className="absolute -top-[20vmax] left-[25vw] size-[60vmax] rounded-full"
            style={{ background: mancha(color, 0.24) }}
            initial={false}
            animate={{ opacity: TONO[fase] === color ? 1 : 0 }}
            transition={{ duration: 0.8 }}
          />
        ))}
        {/* Reflectores: dos conos de luz que barren desde arriba. */}
        <span
          className="reflector absolute -top-[12vh] left-[14vw] h-[130vh] w-[18vw] origin-top bg-linear-to-b from-white/[0.09] to-transparent [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]"
          style={{ animation: 'reflector 11s ease-in-out infinite' }}
        />
        <span
          className="reflector absolute -top-[12vh] right-[14vw] h-[130vh] w-[18vw] origin-top bg-linear-to-b from-white/[0.09] to-transparent [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]"
          style={{ animation: 'reflector 13s ease-in-out infinite reverse' }}
        />
      </div>
      <div className="relative flex h-full flex-col px-[4vw] pt-[3vh] pb-[4vh]">{children}</div>
    </motion.div>
  );
}

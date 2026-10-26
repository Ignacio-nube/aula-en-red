import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { CRITERIOS, NIVELES, NOMBRE_NIVEL, type EvaluacionPassword, type NivelPassword } from '@aula/shared';
import { cn } from '@/lib/utils';

const CARITA: Record<NivelPassword, string> = {
  debil: '😟',
  media: '😐',
  fuerte: '😄',
  'muy-fuerte': '🤩',
};

const COLOR: Record<NivelPassword, string> = {
  debil: 'var(--pd-nivel-debil)',
  media: 'var(--pd-nivel-media)',
  fuerte: 'var(--pd-nivel-fuerte)',
  'muy-fuerte': 'var(--pd-nivel-muy-fuerte)',
};

const resorte = { type: 'spring', stiffness: 520, damping: 22 } as const;

export function MedidorPassword({ evaluacion, minimo }: { evaluacion: EvaluacionPassword; minimo: NivelPassword }) {
  const { vacia, nivel, mensaje, criterios } = evaluacion;
  const indice = NIVELES.indexOf(nivel);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4" aria-live="polite">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-full bg-pd-celeste-claro">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={vacia ? 'vacia' : nivel}
              role="img"
              aria-label={vacia ? 'Sin contraseña' : NOMBRE_NIVEL[nivel]}
              className="text-[2.5rem] leading-none"
              initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: vacia ? 0.35 : 1 }}
              exit={{ scale: 0.3, rotate: 25, opacity: 0 }}
              transition={resorte}
            >
              {vacia ? '🤔' : CARITA[nivel]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-base font-bold">
            {vacia ? 'Fortaleza' : NOMBRE_NIVEL[nivel]}
            <span className="ml-2 text-sm font-medium text-muted-foreground">mínimo: {NOMBRE_NIVEL[minimo]}</span>
          </p>
          <p className="text-sm text-muted-foreground">{mensaje}</p>
        </div>
      </div>

      {/* Barra en 4 tramos, uno por nivel */}
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {NIVELES.map((n, i) => (
          <div key={n} className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{
                width: !vacia && i <= indice ? '100%' : '0%',
                backgroundColor: COLOR[nivel],
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30, delay: i * 0.04 }}
            />
          </div>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {CRITERIOS.map(({ id, texto }) => {
          const ok = !vacia && criterios[id];
          return (
            <li key={id} className={cn('flex items-start gap-2 text-sm transition-colors', ok ? 'text-foreground' : 'text-muted-foreground')}>
              <motion.span
                className="grid size-5 shrink-0 place-items-center rounded-full border-2"
                initial={false}
                animate={{
                  backgroundColor: ok ? 'var(--pd-nivel-fuerte)' : 'rgb(255 255 255 / 0)',
                  borderColor: ok ? 'var(--pd-nivel-fuerte)' : 'var(--input)',
                  scale: ok ? [1, 1.25, 1] : 1,
                }}
                transition={{ duration: 0.35 }}
              >
                <AnimatePresence initial={false}>
                  {ok && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={resorte}>
                      <Check className="size-3 text-white" strokeWidth={3.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span className={cn(ok && 'font-medium')}>{texto}</span>
              <span className="sr-only">{ok ? ': cumplido' : ': falta'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

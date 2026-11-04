import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AVATARES, type AlumnoPublico } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api, mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  onVolver: () => void;
  token: string;
  alumno: AlumnoPublico;
  onGuardado: (alumno: AlumnoPublico) => void;
}

/**
 * El alumno elige su emoji: con un toque queda guardado. Va en el lugar del mensaje de espera y no en
 * una ventana encima: sin velo, sin difuminado y sin zoom, así anda fluido en las compus más lentas.
 */
export function ElegirEmoji({ onVolver, token, alumno, onGuardado }: Props) {
  const [guardando, setGuardando] = useState<string | null>(null);
  const actualRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    actualRef.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onVolver();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onVolver]);

  const elegir = async (avatar: string) => {
    if (guardando) return;
    if (avatar === alumno.avatar) return onVolver();
    setGuardando(avatar);
    try {
      onGuardado(await api<AlumnoPublico>('/alumno/yo', { method: 'PATCH', token, body: { avatar } }));
      onVolver();
    } catch (err) {
      toast.error(mensajeDe(err));
      setGuardando(null);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-20 bajo:pb-6">
      <motion.section
        aria-labelledby="titulo-emoji"
        className="flex w-full max-w-lg flex-col items-center gap-4 rounded-[2rem] bg-card p-5 shadow-[var(--pd-sombra-tarjeta)] sm:p-7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <PinAvatar avatar={guardando ?? alumno.avatar} tamano={72} className="bajo:hidden" />
        <div className="flex flex-col gap-1 text-center">
          <h1 id="titulo-emoji" className="text-2xl font-extrabold sm:text-3xl">
            Elegí tu emoji
          </h1>
          <p className="text-muted-foreground">Es el que se ve con tu nombre en la pantalla grande y en el ranking.</p>
        </div>
        <div role="radiogroup" aria-labelledby="titulo-emoji" className="grid w-full grid-cols-6 gap-1.5 sm:grid-cols-8">
          {AVATARES.map((a) => {
            const actual = a === alumno.avatar;
            return (
              <button
                key={a}
                ref={actual ? actualRef : undefined}
                type="button"
                role="radio"
                aria-checked={actual}
                aria-label={a}
                disabled={guardando !== null}
                onClick={() => void elegir(a)}
                className={cn(
                  'grid aspect-square place-items-center rounded-2xl text-[1.6rem] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90 disabled:opacity-60',
                  actual && 'bg-pd-celeste-claro ring-2 ring-pd-celeste',
                )}
              >
                {guardando === a ? <Spinner /> : a}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={onVolver} disabled={guardando !== null}>
          <ArrowLeft data-icon="inline-start" />
          Volver sin cambiar
        </Button>
      </motion.section>
    </div>
  );
}

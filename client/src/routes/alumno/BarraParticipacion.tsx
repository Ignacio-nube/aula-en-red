import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { LIMITE_PREGUNTA_ANONIMA, type MiMano, type TipoSenal } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMisSenales } from '@/lib/clase';
import { emitirConAck } from '@/lib/juego';
import type { SocketAula } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { BotonMano } from './BotonMano';

const SENALES: { tipo: TipoSenal; emoji: string; texto: string; aviso: string }[] = [
  { tipo: 'noEntendi', emoji: '🤔', texto: 'No entendí', aviso: 'Le avisaste al profe que no entendiste. No sabe que fuiste vos.' },
  { tipo: 'despacio', emoji: '🐢', texto: 'Más despacio', aviso: 'Le pediste al profe que vaya más despacio. No sabe que fuiste vos.' },
];

const boton =
  'flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap shadow-[var(--pd-sombra-tarjeta)] ring-1 ring-foreground/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60';

/**
 * Todo lo que el alumno puede hacer sin interrumpir: levantar la mano, avisar (en forma anónima)
 * que no entendió o que vaya más despacio, y mandar una pregunta anónima.
 */
export function BarraParticipacion({ socket, mano, className }: { socket: SocketAula | null; mano: MiMano; className?: string }) {
  const mias = useMisSenales(socket);
  const [preguntando, setPreguntando] = useState(false);

  const cambiar = async (tipo: TipoSenal, aviso: string) => {
    const activa = !mias[tipo];
    const r = await emitirConAck(socket, 'senal:cambiar', { tipo, activa });
    if (!r.ok) toast.error(r.error);
    else if (activa) toast.success(aviso);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <BotonMano socket={socket} mano={mano} />
      {SENALES.map((s) => (
        <Tooltip key={s.tipo}>
          <TooltipTrigger asChild>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              aria-pressed={mias[s.tipo]}
              aria-label={s.texto}
              onClick={() => void cambiar(s.tipo, s.aviso)}
              className={cn(boton, mias[s.tipo] ? 'bg-pd-celeste-oscuro text-white' : 'vidrio')}
            >
              <motion.span
                aria-hidden
                className="text-lg leading-none"
                animate={mias[s.tipo] ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
                transition={{ duration: 0.5 }}
              >
                {s.emoji}
              </motion.span>
              <span className="max-md:sr-only">{s.texto}</span>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>{mias[s.tipo] ? 'Ya le avisaste. Tocá de nuevo para sacarlo.' : `${s.texto} (anónimo)`}</TooltipContent>
        </Tooltip>
      ))}
      <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Preguntar sin decir quién soy" onClick={() => setPreguntando(true)} className={cn(boton, 'vidrio')}>
        <span aria-hidden className="text-lg leading-none">
          💬
        </span>
        <span className="max-md:sr-only">Preguntar</span>
      </motion.button>
      <DialogoPregunta abierto={preguntando} onCerrar={() => setPreguntando(false)} socket={socket} />
    </div>
  );
}

function DialogoPregunta({ abierto, onCerrar, socket }: { abierto: boolean; onCerrar: () => void; socket: SocketAula | null }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (texto.trim().length < 3) return;
    setEnviando(true);
    const r = await emitirConAck(socket, 'pregunta:enviar', texto);
    setEnviando(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success('Tu pregunta le llegó al profe, sin tu nombre.');
    setTexto('');
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Preguntale al profe</DialogTitle>
            <DialogDescription>Le llega sin tu nombre: nadie sabe quién la mandó, ni el profe.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="pregunta-anonima">Tu pregunta</FieldLabel>
            <Textarea
              id="pregunta-anonima"
              autoFocus
              rows={3}
              maxLength={LIMITE_PREGUNTA_ANONIMA}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Cómo hago para…?"
            />
            <FieldDescription className="text-right tabular-nums">
              {texto.length}/{LIMITE_PREGUNTA_ANONIMA}
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={texto.trim().length < 3 || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              Mandar pregunta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

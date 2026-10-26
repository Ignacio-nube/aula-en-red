import { Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Anillo que se vacía con el tiempo. En los últimos 5 segundos se pone coral. */
export function Temporizador({
  restanteMs,
  totalMs,
  pausado = false,
  tamano = 96,
  className,
}: {
  restanteMs: number;
  totalMs: number;
  pausado?: boolean;
  tamano?: number;
  className?: string;
}) {
  const segundos = Math.ceil(restanteMs / 1000);
  const fraccion = totalMs > 0 ? Math.max(0, Math.min(1, restanteMs / totalMs)) : 0;
  const urgente = segundos <= 5 && restanteMs > 0;
  const r = 44;
  const largo = 2 * Math.PI * r;

  return (
    <div
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: tamano, height: tamano }}
      role="timer"
      aria-label={pausado ? `Pausado, quedan ${segundos} segundos` : `Quedan ${segundos} segundos`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="var(--card)" stroke="var(--muted)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgente ? 'var(--pd-resp-b)' : 'var(--pd-celeste)'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - fraccion)}
          style={{ transition: 'stroke 0.3s' }}
        />
      </svg>
      {pausado ? (
        <Pause className="relative text-muted-foreground" style={{ width: tamano * 0.36, height: tamano * 0.36 }} />
      ) : (
        <span
          className={cn('relative font-extrabold tabular-nums', urgente && 'text-pd-resp-b')}
          style={{ fontSize: tamano * 0.38, color: urgente ? 'var(--pd-resp-b)' : undefined }}
        >
          {segundos}
        </span>
      )}
    </div>
  );
}

import { equipo } from '@aula/shared';
import { cn } from '@/lib/utils';

/** Mascota del equipo en un círculo de su color. */
export function MascotaEquipo({ indice, className }: { indice: number; className?: string }) {
  const e = equipo(indice);
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full leading-none', className)} style={{ backgroundColor: e.color }} aria-hidden>
      <span className="text-[0.6em]">{e.mascota}</span>
    </span>
  );
}

/** Pastilla "🐬 Celestes", para la barra del alumno o una lista. */
export function ChipEquipo({ indice, className }: { indice: number; className?: string }) {
  const e = equipo(indice);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold', className)}
      style={{ backgroundColor: e.color, color: e.texto }}
    >
      <span aria-hidden>{e.mascota}</span>
      {e.nombre}
    </span>
  );
}

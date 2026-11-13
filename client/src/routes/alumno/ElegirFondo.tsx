import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cambiarFondo, claseFondo, EMOJI_FONDO, FONDOS, NOMBRE_FONDO, useFondo } from '@/lib/fondo';
import { useTema } from '@/lib/tema';
import { cn } from '@/lib/utils';

/**
 * Elegir el fondo de la sala de espera. Es un menú y no un diálogo: sin velo ni desenfoque encima, el
 * fondo sigue moviéndose fluido y el cambio se ve al instante.
 */
export function ElegirFondo() {
  const fondo = useFondo();
  const { oscuro } = useTema();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Cambiar el fondo. Ahora: ${NOMBRE_FONDO[fondo]}`}>
          <Palette data-icon="inline-start" />
          Fondo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" data-koi-ignore className="p-2">
        <DropdownMenuLabel>Elegí tu fondo</DropdownMenuLabel>
        <div className="flex gap-2">
          {FONDOS.map((f) => (
            <DropdownMenuItem
              key={f}
              role="menuitemradio"
              aria-checked={fondo === f}
              // El menú queda abierto: se puede probar uno y otro.
              onSelect={(ev) => {
                ev.preventDefault();
                cambiarFondo(f);
              }}
              className="flex-col gap-1.5 rounded-2xl p-1.5 text-xs font-semibold"
            >
              <span
                className={cn(
                  'relative grid h-16 w-24 place-items-center rounded-xl text-2xl ring-2 ring-transparent transition-shadow',
                  claseFondo(f, oscuro),
                  fondo === f && 'ring-pd-celeste',
                )}
                aria-hidden
              >
                {EMOJI_FONDO[f]}
                {fondo === f && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-pd-celeste-oscuro text-white">
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                )}
              </span>
              {NOMBRE_FONDO[f]}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Feather } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cambiarLiviano, useLiviano } from '@/lib/liviano';

/** Interruptor del modo liviano (para PCs lentas). Queda guardado en esta compu. */
export function BotonLiviano({ conTexto = false }: { conTexto?: boolean }) {
  const liviano = useLiviano();
  const boton = (
    <Button
      variant={liviano ? 'secondary' : 'ghost'}
      size={conTexto ? 'sm' : 'icon'}
      aria-pressed={liviano}
      aria-label={conTexto ? undefined : liviano ? 'Modo liviano activado' : 'Activar modo liviano'}
      onClick={() => cambiarLiviano(!liviano)}
    >
      <Feather data-icon={conTexto ? 'inline-start' : undefined} />
      {conTexto && (liviano ? 'Modo liviano activado' : 'Modo liviano')}
    </Button>
  );
  if (conTexto) return boton;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{boton}</TooltipTrigger>
      <TooltipContent>{liviano ? 'Modo liviano activado: tocá para volver al normal' : 'Modo liviano: para compus lentas'}</TooltipContent>
    </Tooltip>
  );
}

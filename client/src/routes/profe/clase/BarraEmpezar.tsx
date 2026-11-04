import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  /** Lo que se va a empezar ("Atajos de teclado con la comisión Tarde"), o lo que falta elegir. */
  resumen: string;
  falta: boolean;
  texto: string;
  enviando: boolean;
  onEmpezar: () => void;
}

/**
 * La barra para empezar algo en clase: queda pegada abajo mientras se eligen las opciones, así el botón
 * siempre está a la vista. Si falta algo, lo dice en vez de dejar el botón apagado sin explicación.
 */
export function BarraEmpezar({ resumen, falta, texto, enviando, onEmpezar }: Props) {
  return (
    <div className="vidrio sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 -mx-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-3xl px-4 py-3 shadow-[var(--pd-sombra-flotante)] lg:bottom-4">
      <span className={falta ? 'text-sm font-medium text-muted-foreground' : 'text-sm font-semibold'}>{resumen}</span>
      <Button size="lg" disabled={falta || enviando} onClick={onEmpezar}>
        {enviando ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
        {texto}
      </Button>
    </div>
  );
}

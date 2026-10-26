import type { EstadoPresentacion } from '@aula/shared';
import { Diapositiva } from '@/components/pd/Diapositiva';
import { urlPresentacion, useDocumentoPdf } from '@/lib/pdf';

/** La diapositiva actual, lo más grande posible. La siguiente ya queda dibujada por adelantado. */
export function PresentacionPantalla({ estado }: { estado: EstadoPresentacion }) {
  const url = urlPresentacion(estado.archivo);
  const { doc, error } = useDocumentoPdf(url);
  return (
    <div className="absolute inset-0 flex flex-col p-[1.5vh]">
      {error ? (
        <p className="grid flex-1 place-items-center text-[2vw] text-muted-foreground">No se pudo abrir la presentación.</p>
      ) : (
        <Diapositiva
          doc={doc}
          url={url}
          pagina={estado.pagina}
          precargar={[estado.pagina + 1, estado.pagina - 1]}
          claseMarco="rounded-[1.2vh] shadow-[var(--pd-sombra-flotante)]"
        />
      )}
      <span className="pointer-events-none absolute bottom-[0.6vh] left-[1.5vh] text-[clamp(0.7rem,0.9vw,1.1rem)] font-medium text-muted-foreground tabular-nums">
        {estado.pagina} / {estado.paginas}
      </span>
    </div>
  );
}

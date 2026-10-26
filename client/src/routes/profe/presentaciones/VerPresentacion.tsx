import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Presentacion } from '@aula/shared';
import { Diapositiva } from '@/components/pd/Diapositiva';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { urlPresentacion, useDocumentoPdf } from '@/lib/pdf';

/** Revisar una presentación antes de pasarla en clase. */
export function VerPresentacion({
  presentacion: p,
  onCerrar,
  onPresentar,
}: {
  presentacion: Presentacion | null;
  onCerrar: () => void;
  onPresentar: (p: Presentacion) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const url = p ? urlPresentacion(p.archivo) : null;
  const { doc, error } = useDocumentoPdf(url);
  useEffect(() => setPagina(1), [p?.id]);

  const ir = (n: number) => p && setPagina(Math.min(Math.max(n, 1), p.paginas));

  return (
    <Dialog open={p !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent
        className="max-w-[min(92vw,1100px)] sm:max-w-[min(92vw,1100px)]"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(pagina + 1);
          else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(pagina - 1);
        }}
      >
        <DialogHeader>
          <DialogTitle>{p?.titulo}</DialogTitle>
          <DialogDescription>
            Diapositiva {pagina} de {p?.paginas}. Podés pasarlas con las flechas del teclado.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[min(58vh,560px)] rounded-2xl bg-muted p-3">
          {error ? (
            <p className="grid h-full place-items-center text-muted-foreground">No se pudo abrir el PDF.</p>
          ) : (
            url && <Diapositiva doc={doc} url={url} pagina={pagina} precargar={[pagina + 1]} claseMarco="rounded-lg shadow-sm" />
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Siguiente" disabled={!p || pagina >= p.paginas} onClick={() => ir(pagina + 1)}>
              <ChevronRight />
            </Button>
          </div>
          {p && (
            <Button onClick={() => onPresentar(p)}>
              <Play data-icon="inline-start" />
              Presentar en clase
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

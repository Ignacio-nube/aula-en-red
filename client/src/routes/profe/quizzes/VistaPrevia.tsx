import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { mezclar } from '@aula/shared';
import { PreguntaAlumno } from '@/components/pd/PreguntaAlumno';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PreguntaBorrador } from './borrador';

/** Cómo ve la pregunta un alumno, en un marco con la proporción de su pantalla (1366 × 768). */
export function VistaPrevia({
  abierta,
  onCerrar,
  pregunta,
  numero,
  total,
}: {
  abierta: boolean;
  onCerrar: () => void;
  pregunta: PreguntaBorrador;
  numero: number;
  total: number;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  useEffect(() => setElegida(null), [abierta, pregunta.clave]);

  const enJuego = {
    id: 0,
    tipo: pregunta.tipo,
    texto: pregunta.texto || 'Escribí la pregunta…',
    imagen: pregunta.imagen,
    multiplicador: pregunta.multiplicador,
    opciones: pregunta.opciones.map((o, i) => ({ id: i, texto: o.texto || `${pregunta.tipo === 'ordenar' ? 'Paso' : 'Opción'} ${i + 1}` })),
  };
  // Los pasos se muestran mezclados, como los va a ver el alumno.
  if (enJuego.tipo === 'ordenar') enJuego.opciones = mezclar(enJuego.opciones, pregunta.clave.length + 7);

  return (
    <Dialog open={abierta} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-[min(92vw,1100px)] sm:max-w-[min(92vw,1100px)]">
        <DialogHeader>
          <DialogTitle>Vista previa</DialogTitle>
          <DialogDescription>Así la ve un alumno en su compu. Podés tocar una opción para probar.</DialogDescription>
        </DialogHeader>
        {/* El ancho sale del alto disponible, para que en 1366 × 768 el marco entre entero. */}
        <div className="fondo-pd mx-auto aspect-[1366/768] w-[min(100%,calc(62vh*1366/768))] overflow-hidden rounded-2xl ring-1 ring-foreground/10">
          <PreguntaAlumno
            pregunta={enJuego}
            indice={numero}
            total={total}
            restanteMs={pregunta.tiempoSeg * 1000}
            totalMs={pregunta.tiempoSeg * 1000}
            elegida={elegida}
            bloqueado={elegida !== null}
            onResponder={(r) => {
              if (typeof r === 'number') setElegida(r);
              else toast.success(pregunta.tipo === 'ordenar' ? 'Así se manda el orden. ¡Funciona!' : 'Así se mandan las respuestas. ¡Funciona!');
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

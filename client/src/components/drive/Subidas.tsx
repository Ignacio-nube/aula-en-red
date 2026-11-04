import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, X } from 'lucide-react';
import type { MiDrive } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { mensajeDe } from '@/lib/api';
import { iconoDe, subirArchivo } from '@/lib/drive';
import { cn } from '@/lib/utils';

interface Subida {
  id: number;
  nombre: string;
  mime: string;
  progreso: number;
  estado: 'subiendo' | 'listo' | 'error';
  error?: string;
  cancelar: () => void;
}

/** Las subidas en curso: cada archivo con su barra, como el panel de abajo a la derecha del Drive real. */
export function useSubidas(token: string, onDrive: (d: MiDrive) => void) {
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const siguiente = useRef(1);

  const cambiar = (id: number, cambio: Partial<Subida>) => setSubidas((l) => l.map((s) => (s.id === id ? { ...s, ...cambio } : s)));

  const subir = useCallback(
    (archivos: File[], padreId: number | null) => {
      for (const archivo of archivos) {
        const id = siguiente.current++;
        const { promesa, cancelar } = subirArchivo(archivo, padreId, token, (p) => cambiar(id, { progreso: p }));
        setSubidas((l) => [...l, { id, nombre: archivo.name, mime: archivo.type, progreso: 0, estado: 'subiendo', cancelar }]);
        promesa.then(
          (d) => {
            cambiar(id, { estado: 'listo', progreso: 1 });
            onDrive(d);
          },
          (e) => cambiar(id, { estado: 'error', error: mensajeDe(e) }),
        );
      }
    },
    [token, onDrive],
  );

  const cerrar = () =>
    setSubidas((l) => {
      l.forEach((s) => s.estado === 'subiendo' && s.cancelar());
      return [];
    });

  return { subidas, subir, cerrar };
}

export function PanelSubidas({ subidas, onCerrar }: { subidas: Subida[]; onCerrar: () => void }) {
  const [plegado, setPlegado] = useState(false);
  const subiendo = subidas.filter((s) => s.estado === 'subiendo').length;
  const listos = subidas.filter((s) => s.estado === 'listo').length;
  const titulo =
    subiendo > 0
      ? `Subiendo ${subiendo} ${subiendo === 1 ? 'elemento' : 'elementos'}`
      : listos > 0
        ? `Se ${listos === 1 ? 'subió 1 elemento' : `subieron ${listos} elementos`}`
        : 'No se pudo subir';

  return (
    <AnimatePresence>
      {subidas.length > 0 && (
        <motion.section
          aria-label="Subidas"
          className="fixed right-3 bottom-3 z-30 w-[min(22rem,calc(100%-1.5rem))] md:absolute overflow-hidden rounded-2xl bg-card shadow-[var(--pd-sombra-flotante)] ring-1 ring-foreground/10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <header className="flex items-center gap-1 bg-muted py-1.5 pr-1.5 pl-4">
            <h2 className="flex-1 truncate text-sm font-semibold" role="status">
              {titulo}
            </h2>
            <Button variant="ghost" size="icon-sm" aria-label={plegado ? 'Mostrar' : 'Ocultar'} onClick={() => setPlegado(!plegado)}>
              <ChevronDown className={cn('transition-transform', plegado && 'rotate-180')} />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={onCerrar}>
              <X />
            </Button>
          </header>
          {!plegado && (
            <ul className="max-h-60 overflow-y-auto py-1">
              {subidas.map((s) => {
                const { icono: Icono, color } = iconoDe({ tipo: 'archivo', mime: s.mime, nombre: s.nombre });
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                    <Icono className={cn('size-5 shrink-0', color)} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{s.nombre}</span>
                      {s.estado === 'error' && <span className="text-xs text-destructive">{s.error}</span>}
                    </span>
                    {s.estado === 'subiendo' && <Anillo fraccion={s.progreso} />}
                    {s.estado === 'listo' && (
                      <span className="grid size-5 place-items-center rounded-full bg-[#188038] text-white">
                        <Check className="size-3.5" strokeWidth={3} aria-label="Subido" />
                      </span>
                    )}
                    {s.estado === 'error' && <CircleAlert className="size-5 text-destructive" aria-label="Error" />}
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** Progreso circular, como en el Drive real. */
function Anillo({ fraccion }: { fraccion: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 20 20" className="size-5 -rotate-90" role="progressbar" aria-valuenow={Math.round(fraccion * 100)} aria-valuemin={0} aria-valuemax={100}>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-pd-celeste-oscuro transition-[stroke-dashoffset] duration-200"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0.04, fraccion))}
      />
    </svg>
  );
}

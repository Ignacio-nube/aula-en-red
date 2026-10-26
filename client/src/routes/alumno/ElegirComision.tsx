import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { RotateCw, Users } from 'lucide-react';
import type { Comision } from '@aula/shared';
import { Logo } from '@/components/pd/Logo';
import { PinLoader } from '@/components/pd/Pin';
import { Tocable } from '@/components/pd/Tocable';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { api, mensajeDe } from '@/lib/api';
import { CLAVES, leer } from '@/lib/almacen';
import { cn } from '@/lib/utils';
import { lista, item } from './animaciones';

export function ElegirComision({ nombreCurso, onElegir }: { nombreCurso?: string; onElegir: (c: Comision) => void }) {
  const [comisiones, setComisiones] = useState<Comision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ultima = Number(leer(CLAVES.ultimaComision));

  const cargar = () => {
    setError(null);
    api<Comision[]>('/comisiones')
      .then(setComisiones)
      .catch((e) => setError(mensajeDe(e)));
  };
  useEffect(cargar, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo alto={92} />
        <h1 className="text-4xl font-extrabold">¡Hola! Elegí tu comisión</h1>
        {nombreCurso && <p className="text-lg text-muted-foreground">{nombreCurso}</p>}
      </div>

      {error ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No pudimos cargar las comisiones</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={cargar}>
              <RotateCw data-icon="inline-start" />
              Reintentar
            </Button>
          </EmptyContent>
        </Empty>
      ) : comisiones === null ? (
        <PinLoader tamano={48} />
      ) : comisiones.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Todavía no hay comisiones</EmptyTitle>
            <EmptyDescription>El profe las crea desde su panel. Cuando estén, tocá Reintentar.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={cargar}>
              <RotateCw data-icon="inline-start" />
              Reintentar
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <motion.ul
          variants={lista}
          initial="oculto"
          animate="visible"
          className={cn('grid w-full gap-4', comisiones.length === 1 ? 'max-w-sm grid-cols-1' : 'grid-cols-1 sm:grid-cols-2', comisiones.length >= 3 && 'lg:grid-cols-3')}
        >
          {comisiones.map((c) => (
            <motion.li key={c.id} variants={item}>
              <Tocable
                onClick={() => onElegir(c)}
                className={cn('flex w-full flex-col gap-3 p-6', c.id === ultima && 'ring-2 ring-pd-celeste')}
              >
                <span className="text-2xl font-bold">{c.nombre}</span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  {c.cantidadAlumnos === 1 ? '1 alumno' : `${c.cantidadAlumnos} alumnos`}
                </span>
              </Tocable>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

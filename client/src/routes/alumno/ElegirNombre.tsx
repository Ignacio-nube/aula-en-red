import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, RotateCw } from 'lucide-react';
import type { AlumnoPublico, Comision } from '@aula/shared';
import { Logo } from '@/components/pd/Logo';
import { PinAvatar, PinLoader } from '@/components/pd/Pin';
import { Tocable } from '@/components/pd/Tocable';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { api, mensajeDe } from '@/lib/api';
import { item, lista } from './animaciones';

interface Props {
  comision: Comision;
  onVolver: () => void;
  onElegir: (alumno: AlumnoPublico) => void;
}

export function ElegirNombre({ comision, onVolver, onElegir }: Props) {
  const [alumnos, setAlumnos] = useState<AlumnoPublico[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setError(null);
    api<AlumnoPublico[]>(`/comisiones/${comision.id}/alumnos`)
      .then(setAlumnos)
      .catch((e) => setError(mensajeDe(e)));
  };
  useEffect(cargar, [comision.id]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onVolver}>
          <ChevronLeft data-icon="inline-start" />
          Cambiar comisión
        </Button>
        <Logo alto={50} />
      </div>

      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-extrabold sm:text-4xl">¿Quién sos?</h1>
        <p className="text-lg text-muted-foreground">Comisión {comision.nombre}</p>
      </div>

      {error ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No pudimos cargar la lista</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={cargar}>
              <RotateCw data-icon="inline-start" />
              Reintentar
            </Button>
          </EmptyContent>
        </Empty>
      ) : alumnos === null ? (
        <div className="grid flex-1 place-items-center">
          <PinLoader tamano={48} />
        </div>
      ) : alumnos.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Esta comisión todavía no tiene alumnos</EmptyTitle>
            <EmptyDescription>Pedile al profe que te agregue a la lista.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <motion.ul
          variants={lista}
          initial="oculto"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {alumnos.map((a) => (
            <motion.li key={a.id} variants={item}>
              {/* En el celu, el avatar va arriba: así el nombre tiene todo el ancho y no se corta a mitad de palabra. */}
              <Tocable
                onClick={() => onElegir(a)}
                className="flex h-full w-full flex-col items-center gap-2 p-3 text-center sm:flex-row sm:gap-3 sm:pr-4 sm:text-left"
              >
                <PinAvatar avatar={a.avatar} tamano={44} />
                <span className="min-w-0 text-base leading-tight font-semibold text-balance hyphens-auto sm:text-lg">{a.nombre}</span>
              </Tocable>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

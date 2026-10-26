import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import type { AlumnoPublico, Comision, SesionAlumno } from '@aula/shared';
import { PinLoader } from '@/components/pd/Pin';
import { api } from '@/lib/api';
import { CLAVES, guardar, leer } from '@/lib/almacen';
import { useInfo } from '@/lib/info';
import { ElegirComision } from './ElegirComision';
import { ElegirNombre } from './ElegirNombre';
import { Password } from './Password';
import { SalaEspera } from './SalaEspera';

export type Paso =
  | { tipo: 'cargando' }
  | { tipo: 'comision' }
  | { tipo: 'nombre'; comision: Comision }
  | { tipo: 'password'; comision: Comision; alumno: AlumnoPublico }
  | { tipo: 'sala'; token: string; alumno: AlumnoPublico };

export function AlumnoApp() {
  const info = useInfo();
  const [paso, setPaso] = useState<Paso>({ tipo: 'cargando' });

  // Si ya hay un token guardado y sigue valiendo, directo a la sala.
  useEffect(() => {
    const token = leer(CLAVES.tokenAlumno);
    if (!token) return setPaso({ tipo: 'comision' });
    api<AlumnoPublico>('/alumno/yo', { token })
      .then((alumno) => setPaso({ tipo: 'sala', token, alumno }))
      .catch(() => {
        guardar(CLAVES.tokenAlumno, null);
        setPaso({ tipo: 'comision' });
      });
  }, []);

  const entrar = useCallback((sesion: SesionAlumno) => {
    guardar(CLAVES.tokenAlumno, sesion.token);
    setPaso({ tipo: 'sala', token: sesion.token, alumno: sesion.alumno });
  }, []);

  const salir = useCallback((motivo?: string) => {
    const token = leer(CLAVES.tokenAlumno);
    if (token && !motivo) void api('/alumno/logout', { method: 'POST', token }).catch(() => {});
    guardar(CLAVES.tokenAlumno, null);
    if (motivo) toast.info(motivo);
    setPaso({ tipo: 'comision' });
  }, []);

  return (
    <main className="flex min-h-dvh flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={paso.tipo}
          className="flex flex-1 flex-col"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          {paso.tipo === 'cargando' && (
            <div className="grid flex-1 place-items-center">
              <PinLoader />
            </div>
          )}
          {paso.tipo === 'comision' && (
            <ElegirComision
              nombreCurso={info?.nombreCurso}
              onElegir={(comision) => {
                guardar(CLAVES.ultimaComision, String(comision.id));
                setPaso({ tipo: 'nombre', comision });
              }}
            />
          )}
          {paso.tipo === 'nombre' && (
            <ElegirNombre
              comision={paso.comision}
              onVolver={() => setPaso({ tipo: 'comision' })}
              onElegir={(alumno) => setPaso({ tipo: 'password', comision: paso.comision, alumno })}
            />
          )}
          {paso.tipo === 'password' && (
            <Password
              alumno={paso.alumno}
              nivelMinimo={info?.nivelMinimoPassword ?? 'media'}
              onVolver={() => setPaso({ tipo: 'nombre', comision: paso.comision })}
              onEntrar={entrar}
              onCambioEstado={(alumno) => setPaso({ ...paso, alumno })}
            />
          )}
          {paso.tipo === 'sala' && (
            <SalaEspera
              token={paso.token}
              alumno={paso.alumno}
              nombreCurso={info?.nombreCurso}
              onSalir={salir}
              onActualizar={(alumno) => setPaso({ ...paso, alumno })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

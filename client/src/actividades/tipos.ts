import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AlumnoPublico, EstadoActividad, InfoServidor, TipoActividad } from '@aula/shared';
import type { SocketAula } from '@/lib/socket';

export type EstadoDe<T extends TipoActividad> = Extract<EstadoActividad, { tipo: T }>;

export interface PropsPreparar {
  /** Comisión elegida arriba (vacío = ninguna todavía). */
  comisionId: string;
  nombreComision?: string;
}

/** Cada actividad trae sus cuatro pantallas: preparar y controlar (profe), alumno y pantalla grande. */
export interface DefinicionActividad<T extends TipoActividad> {
  nombre: string;
  /** Una línea: qué hacen los alumnos. */
  descripcion: string;
  icono: LucideIcon;
  /** Título del paso 3 en "Clase en vivo" (por ejemplo, "¿Con qué texto?"). */
  paso3: string;
  /** Mientras está en curso no se ofrece salir al alumno (un toque sin querer lo sacaría). */
  enCurso: (estado: EstadoDe<T>) => boolean;
  Preparar: ComponentType<PropsPreparar>;
  Control: ComponentType<{ estado: EstadoDe<T>; recibido: number }>;
  Alumno: ComponentType<{ estado: EstadoDe<T>; recibido: number; socket: SocketAula | null; alumno: AlumnoPublico; token: string }>;
  Pantalla: ComponentType<{ estado: EstadoDe<T>; recibido: number; info: InfoServidor | null }>;
}

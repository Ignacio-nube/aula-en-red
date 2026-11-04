import { HardDrive, Keyboard, Vote } from 'lucide-react';
import type { EstadoActividad, TipoActividad } from '@aula/shared';
import { AlumnoMisiones } from './drive/Alumno';
import { ControlMisiones } from './drive/Control';
import { PantallaMisiones } from './drive/Pantalla';
import { PrepararMisiones } from './drive/Preparar';
import { AlumnoGaleria } from './galeria/Alumno';
import { ControlGaleria } from './galeria/Control';
import { PantallaGaleria } from './galeria/Pantalla';
import { PrepararGaleria } from './galeria/Preparar';
import { AlumnoTipeo } from './tipeo/Alumno';
import { ControlTipeo } from './tipeo/Control';
import { PantallaTipeo } from './tipeo/Pantalla';
import { PrepararTipeo } from './tipeo/Preparar';
import type { DefinicionActividad } from './tipos';

/** Para sumar una actividad: su carpeta en actividades/ y una entrada acá. */
export const ACTIVIDADES: { [T in TipoActividad]: DefinicionActividad<T> } = {
  tipeo: {
    nombre: 'Carrera de tipeo',
    descripcion: 'Todos tipean el mismo texto y en la pantalla grande se ve la carrera en vivo.',
    icono: Keyboard,
    paso3: '¿Con qué texto?',
    enCurso: (e) => e.vista.fase !== 'fin',
    Preparar: PrepararTipeo,
    Control: ControlTipeo,
    Alumno: AlumnoTipeo,
    Pantalla: PantallaTipeo,
  },
  drive: {
    nombre: 'Misiones en Drive',
    descripcion: 'Practican crear carpetas, subir y compartir archivos en un Drive simulado. Se tildan solas.',
    icono: HardDrive,
    paso3: '¿Qué misiones?',
    // Se puede salir en cualquier momento: lo que hicieron queda en su Drive.
    enCurso: () => false,
    Preparar: PrepararMisiones,
    Control: ControlMisiones,
    Alumno: AlumnoMisiones,
    Pantalla: PantallaMisiones,
  },
  galeria: {
    nombre: 'Votación de dibujos',
    descripcion: 'Mostrás los dibujos que subieron al Drive uno por uno y la clase los vota con caritas.',
    icono: Vote,
    paso3: '¿Qué dibujos?',
    enCurso: (e) => e.vista.fase !== 'podio',
    Preparar: PrepararGaleria,
    Control: ControlGaleria,
    Alumno: AlumnoGaleria,
    Pantalla: PantallaGaleria,
  },
};

/** La definición de la actividad de un estado, con los tipos ya acomodados. */
export function definicionDe(estado: EstadoActividad): DefinicionActividad<TipoActividad> {
  return ACTIVIDADES[estado.tipo] as DefinicionActividad<TipoActividad>;
}

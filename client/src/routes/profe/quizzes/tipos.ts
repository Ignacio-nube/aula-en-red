import { Keyboard, ListChecks, ListOrdered, SquareCheckBig, ToggleLeft } from 'lucide-react';
import type { TipoPregunta } from '@aula/shared';

/** Ícono y una línea de qué es cada tipo de pregunta, para el editor. */
export const INFO_TIPO: Record<TipoPregunta, { icono: typeof ListChecks; descripcion: string }> = {
  multiple: { icono: ListChecks, descripcion: 'Una sola correcta entre 2 a 4' },
  vf: { icono: ToggleLeft, descripcion: 'Verdadero o falso' },
  varias: { icono: SquareCheckBig, descripcion: 'Hay que marcar todas las correctas' },
  ordenar: { icono: ListOrdered, descripcion: 'Poner los pasos en orden' },
  tipeo: { icono: Keyboard, descripcion: 'Todos tipean una frase, en carrera' },
};

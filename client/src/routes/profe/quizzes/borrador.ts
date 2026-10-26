// Borrador del editor: el quiz con claves locales estables (para React y para arrastrar),
// que se convierte a QuizEntrada al guardar.
import { maxOpciones, opcionesVF, problemasPregunta, type Multiplicador, type Quiz, type QuizEntrada, type TipoPregunta } from '@aula/shared';

let contador = 0;
export const nuevaClave = () => `k${Date.now().toString(36)}${(contador++).toString(36)}`;

export interface OpcionBorrador {
  clave: string;
  texto: string;
  esCorrecta: boolean;
}

export interface PreguntaBorrador {
  clave: string;
  tipo: TipoPregunta;
  texto: string;
  imagen: string | null;
  tiempoSeg: number;
  multiplicador: Multiplicador;
  opciones: OpcionBorrador[];
}

export interface QuizBorrador {
  id: number;
  titulo: string;
  descripcion: string;
  preguntas: PreguntaBorrador[];
}

const conClaves = (opciones: { texto: string; esCorrecta: boolean }[]): OpcionBorrador[] =>
  opciones.map((o) => ({ clave: nuevaClave(), texto: o.texto, esCorrecta: o.esCorrecta }));

export function aBorrador(q: Quiz): QuizBorrador {
  return {
    id: q.id,
    titulo: q.titulo,
    descripcion: q.descripcion,
    preguntas: q.preguntas.map((p) => ({ ...p, clave: nuevaClave(), opciones: conClaves(p.opciones) })),
  };
}

export function aEntrada(b: QuizBorrador): QuizEntrada {
  return {
    titulo: b.titulo,
    descripcion: b.descripcion,
    preguntas: b.preguntas.map(({ tipo, texto, imagen, tiempoSeg, multiplicador, opciones }) => ({
      tipo,
      texto,
      imagen,
      tiempoSeg,
      multiplicador,
      opciones: opciones.map(({ texto, esCorrecta }) => ({ texto, esCorrecta })),
    })),
  };
}

export function preguntaNueva(tipo: TipoPregunta, base?: Pick<PreguntaBorrador, 'tiempoSeg' | 'multiplicador'>): PreguntaBorrador {
  return {
    clave: nuevaClave(),
    tipo,
    texto: '',
    imagen: null,
    tiempoSeg: base?.tiempoSeg ?? 20,
    multiplicador: base?.multiplicador ?? 1,
    opciones:
      tipo === 'vf'
        ? conClaves(opcionesVF(true))
        : conClaves([0, 1, 2, 3].map(() => ({ texto: '', esCorrecta: tipo === 'ordenar' }))),
  };
}

export function duplicarPregunta(p: PreguntaBorrador): PreguntaBorrador {
  return { ...p, clave: nuevaClave(), opciones: p.opciones.map((o) => ({ ...o, clave: nuevaClave() })) };
}

/** Cambia el tipo conservando lo que se pueda (texto, imagen, tiempo, puntos). */
export function cambiarTipo(p: PreguntaBorrador, tipo: TipoPregunta): PreguntaBorrador {
  if (p.tipo === tipo) return p;
  // Entre opción múltiple, varias correctas y ordenar se conservan los textos de las opciones.
  if (p.tipo !== 'vf' && tipo !== 'vf') {
    let opciones = p.opciones.slice(0, maxOpciones(tipo));
    if (tipo === 'ordenar') opciones = opciones.map((o) => ({ ...o, esCorrecta: true }));
    else if (p.tipo === 'ordenar') opciones = opciones.map((o) => ({ ...o, esCorrecta: false }));
    else if (tipo === 'multiple') {
      const primera = opciones.findIndex((o) => o.esCorrecta);
      opciones = opciones.map((o, i) => ({ ...o, esCorrecta: i === primera }));
    }
    return { ...p, tipo, opciones };
  }
  const nueva = preguntaNueva(tipo, p);
  return { ...nueva, clave: p.clave, texto: p.texto, imagen: p.imagen };
}

export function problemas(p: PreguntaBorrador): string[] {
  return problemasPregunta(p);
}

// Importar preguntas desde texto (o JSON), para armar un quiz rápido con una IA como Claude.
//
//   # Atajos de teclado              ← título del quiz (opcional)
//   ? ¿Qué atajo copia?
//   tiempo: 20                       ← opcional: 5, 10, 20, 30, 60, 90 o 120
//   puntos: doble                    ← opcional: normal, doble o sin
//   * Ctrl + C                       ← correcta
//   - Ctrl + V                       ← incorrecta
//
// El tipo se deduce: pasos numerados (1. 2. 3.) → ordenar; más de una correcta → varias;
// Verdadero/Falso → vf; si no, opción múltiple. También se puede poner "tipo: …" (y "tipo: tipeo"
// para una carrera de tipeo: el texto de la pregunta es lo que hay que tipear).
//
// Al copiar del chat de la IA (en vez de usar su botón de copiar), "*" y "-" se pierden: las líneas
// sueltas se toman como opciones y la correcta se marca tocándola en la vista previa.
import {
  LIMITES,
  maxOpciones,
  opcionesVF,
  problemasPregunta,
  tiempoInicial,
  TIEMPOS_SEG,
  TIPOS_PREGUNTA,
  type Multiplicador,
  type QuizEntrada,
  type TipoPregunta,
} from './quiz';

export type PreguntaImportada = QuizEntrada['preguntas'][number] & {
  /** Línea donde empieza en el texto pegado (desde 1), para ubicar los problemas. */
  linea: number;
  problemas: string[];
};

export interface ResultadoImportar {
  titulo: string | null;
  preguntas: PreguntaImportada[];
  /** Cosas que se ignoraron o se ajustaron (no impiden importar). */
  avisos: string[];
}

const PUNTOS: Record<string, Multiplicador> = { normal: 1, doble: 2, dobles: 2, x2: 2, sin: 0, 'sin puntos': 0, cero: 0 };
const ALIAS_TIPO: Record<string, TipoPregunta> = {
  multiple: 'multiple',
  'opcion multiple': 'multiple',
  vf: 'vf',
  'verdadero o falso': 'vf',
  'verdadero/falso': 'vf',
  varias: 'varias',
  'varias correctas': 'varias',
  ordenar: 'ordenar',
  'ordenar pasos': 'ordenar',
  tipeo: 'tipeo',
  'carrera de tipeo': 'tipeo',
  tipear: 'tipeo',
};

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** El tiempo de la lista más cercano al pedido. */
function tiempoCercano(seg: number): number {
  return TIEMPOS_SEG.reduce((mejor, t) => (Math.abs(t - seg) < Math.abs(mejor - seg) ? t : mejor), 20);
}

interface Crudo {
  linea: number;
  texto: string;
  tipo: TipoPregunta | null;
  tiempoSeg: number;
  /** Si el texto decía "tiempo:" (si no, el tipeo arranca con más tiempo). */
  tiempoDado: boolean;
  multiplicador: Multiplicador;
  opciones: { texto: string; esCorrecta: boolean }[];
  numeradas: number;
}

export function importarPreguntas(entrada: string): ResultadoImportar {
  const texto = entrada.replace(/^﻿/, '').trim();
  if (texto.startsWith('{') || texto.startsWith('[')) {
    try {
      return desdeJson(JSON.parse(texto));
    } catch {
      // No era JSON válido: se intenta como texto.
    }
  }
  return desdeTexto(texto);
}

// Viñetas que quedan al copiar lo que muestra el chat de la IA (ahí "*" y "-" se ven como puntos).
const VINETA = /^[•◦▪●○·–—]\s*/;
// "✅ Ctrl + C", "Ctrl + C ✔", "Ctrl + C (correcta)": la correcta marcada con palabras o emojis.
const MARCA_CORRECTA = /^(?:✅|✔️?|☑️?)\s*|\s*(?:✅|✔️?|☑️?|\((?:la\s+)?correcta\)|\[(?:la\s+)?correcta\]|←\s*correcta)$/i;
const MARCA_INCORRECTA = /^(?:❌|✖️?|✗)\s*|\s*(?:❌|✖️?|\(incorrecta\))$/i;

function desdeTexto(texto: string): ResultadoImportar {
  const avisos: string[] = [];
  const crudas: Crudo[] = [];
  let titulo: string | null = null;
  let actual: Crudo | null = null;
  /** Letra de cada opción ("a)", "B.") de la pregunta actual, para "Respuesta: b". */
  let letras: string[] = [];

  const nueva = (linea: number, enunciado: string) => {
    actual = { linea, texto: enunciado.trim(), tipo: null, tiempoSeg: 20, tiempoDado: false, multiplicador: 1, opciones: [], numeradas: 0 };
    letras = [];
    crudas.push(actual);
  };

  texto.split(/\r?\n/).forEach((original, i) => {
    const linea = i + 1;
    // Las IAs a veces agregan negritas o viñetas de markdown: se sacan.
    const l = original
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .trim();
    if (!l || l.startsWith('```') || /^-{3,}$/.test(l)) return;

    if (/^#{1,3}\s+/.test(l) && !actual && titulo === null) {
      titulo = l
        .replace(/^#+\s+/, '')
        .trim()
        .slice(0, LIMITES.titulo);
      return;
    }
    const pregunta = l.match(/^(?:\?|¿(?=.*\?$)|P:|Pregunta\s*\d*\s*[:.)-])\s*(.+)$/i);
    if (pregunta) {
      // "¿Qué es…?" sin el "?" de adelante también vale: se conserva el "¿".
      nueva(linea, l.startsWith('¿') ? l : pregunta[1]!);
      return;
    }
    if (!actual) {
      // Al copiar del chat, el "# Título" queda como una línea suelta arriba de todo.
      if (titulo === null && crudas.length === 0 && l.length <= LIMITES.titulo) titulo = l.replace(/^#+\s*/, '');
      else avisos.push(`Línea ${linea}: se ignoró porque está antes de la primera pregunta (que empieza con "?").`);
      return;
    }
    const a: Crudo = actual;
    const clave = l.match(/^(tipo|tiempo|puntos)\s*:\s*(.+)$/i);
    if (clave) {
      const valor = sinTildes(clave[2]!);
      const nombre = clave[1]!.toLowerCase();
      if (nombre === 'tiempo') {
        const seg = parseInt(valor, 10);
        if (Number.isFinite(seg)) {
          a.tiempoSeg = tiempoCercano(seg);
          a.tiempoDado = true;
          if (a.tiempoSeg !== seg) avisos.push(`Línea ${linea}: ${seg} s no está en la lista; quedó en ${a.tiempoSeg} s.`);
        }
      } else if (nombre === 'puntos') {
        const m = PUNTOS[valor];
        if (m !== undefined) a.multiplicador = m;
        else avisos.push(`Línea ${linea}: "puntos" puede ser normal, doble o sin.`);
      } else {
        const t = ALIAS_TIPO[valor] ?? (TIPOS_PREGUNTA as readonly string[]).find((x) => x === valor);
        if (t) {
          a.tipo = t as TipoPregunta;
          // Tipear lleva más que elegir: si no se dijo el tiempo, arranca en un minuto.
          if (t === 'tipeo' && !a.tiempoDado) a.tiempoSeg = tiempoInicial('tipeo');
        } else avisos.push(`Línea ${linea}: tipo desconocido "${clave[2]}".`);
      }
      return;
    }
    // "Respuesta: b", "Correcta: Ctrl + C", "Respuestas correctas: A y C".
    const respuesta = l.match(/^(?:respuestas?(?:\s+correctas?)?|correctas?)\s*:\s*(.+)$/i);
    if (respuesta && a.opciones.length > 0) {
      const valor = respuesta[1]!.trim();
      const pedidas = valor
        .split(/\s*(?:,|;|\by\b|\be\b)\s*/i)
        .map((x) => x.replace(/[).]$/, '').trim().toLowerCase())
        .filter(Boolean);
      let marco = false;
      if (pedidas.every((x) => /^[a-f]$/.test(x)) && letras.length > 0) {
        marco = pedidas.some((x) => letras.includes(x));
        if (marco) a.opciones.forEach((o, k) => (o.esCorrecta = pedidas.includes(letras[k] ?? '')));
      } else {
        const buscado = sinTildes(valor.replace(/^[a-f][).]\s+/i, ''));
        a.opciones.forEach((o) => {
          if (sinTildes(o.texto) === buscado) {
            o.esCorrecta = true;
            marco = true;
          }
        });
      }
      if (!marco) avisos.push(`Línea ${linea}: no se encontró la opción "${valor}" para marcarla como correcta.`);
      return;
    }
    if (a.tipo === 'tipeo') {
      // En tipeo no hay opciones: las líneas que siguen son parte del texto para tipear.
      a.texto = `${a.texto} ${l.replace(VINETA, '')}`;
      return;
    }
    // "* " o "- " (con espacio, para no confundir "-5 grados"), "[x]" / "[ ]", "1." / "1)", o "a)" / "B.".
    const opcion = l.match(/^(?:([*+✓✔-])\s+|(\[[xX ]\])\s*|(\d+)\s*[.)]\s+|\(?([a-fA-F])[).]\s+)(.+)$/);
    if (opcion) {
      let resto = opcion[5]!.trim();
      // Un "1. ¿…?" después de las opciones es la pregunta siguiente, numerada.
      if (opcion[3] !== undefined && resto.endsWith('?') && a.opciones.length >= LIMITES.minOpciones && a.numeradas === 0) {
        nueva(linea, resto);
        return;
      }
      const numerada = opcion[3] !== undefined;
      if (numerada) a.numeradas++;
      if (opcion[4] !== undefined) letras[a.opciones.length] = opcion[4].toLowerCase();
      let correcta = numerada || /[*+✓✔]/.test(opcion[1] ?? '') || /x/i.test(opcion[2] ?? '');
      if (MARCA_CORRECTA.test(resto)) {
        correcta = true;
        resto = resto.replace(MARCA_CORRECTA, '').trim();
      } else if (MARCA_INCORRECTA.test(resto)) resto = resto.replace(MARCA_INCORRECTA, '').trim();
      a.opciones.push({ texto: resto, esCorrecta: correcta });
      return;
    }
    // Una línea suelta: si ya hay opciones y termina en "?", es la pregunta siguiente (vino sin el "?" de adelante).
    if (a.opciones.length >= LIMITES.minOpciones && l.endsWith('?') && !VINETA.test(l)) {
      nueva(linea, l);
      return;
    }
    // Si no, es una opción sin marca: pasa al copiar del chat, donde "*" y "-" se ven como viñetas.
    // La correcta se marca después tocándola en la vista previa (o con "Respuesta: …").
    let resto = l.replace(VINETA, '');
    let correcta = false;
    if (MARCA_CORRECTA.test(resto)) {
      correcta = true;
      resto = resto.replace(MARCA_CORRECTA, '').trim();
    } else if (MARCA_INCORRECTA.test(resto)) resto = resto.replace(MARCA_INCORRECTA, '').trim();
    if (resto) a.opciones.push({ texto: resto, esCorrecta: correcta });
  });

  if (crudas.length === 0 && texto) avisos.push('No se encontró ninguna pregunta. Cada pregunta tiene que empezar con "?".');
  return { titulo, preguntas: crudas.map((c) => armar(c, avisos)), avisos };
}

function armar(c: Crudo, avisos: string[]): PreguntaImportada {
  const vf =
    c.opciones.length === 2 &&
    c.opciones.every((o) => ['verdadero', 'falso', 'v', 'f'].includes(sinTildes(o.texto))) &&
    new Set(c.opciones.map((o) => sinTildes(o.texto)[0])).size === 2;
  const correctas = c.opciones.filter((o) => o.esCorrecta).length;
  const tipo: TipoPregunta = c.tipo ?? (c.numeradas > 0 && c.numeradas === c.opciones.length ? 'ordenar' : vf ? 'vf' : correctas > 1 ? 'varias' : 'multiple');

  if (tipo === 'tipeo') {
    // Sin opciones: si vinieron líneas sueltas, son parte del texto para tipear.
    const texto = [c.texto, ...c.opciones.map((o) => o.texto)].join(' ').replace(/\s+/g, ' ').trim();
    if (texto.length > LIMITES.pregunta) avisos.push(`Línea ${c.linea}: el texto para tipear era muy largo y se recortó a ${LIMITES.pregunta} letras.`);
    const p = { tipo, texto: texto.slice(0, LIMITES.pregunta), imagen: null, tiempoSeg: c.tiempoSeg, multiplicador: c.multiplicador, opciones: [] };
    return { ...p, linea: c.linea, problemas: problemasPregunta(p) };
  }
  let opciones = c.opciones.map((o) => ({ texto: o.texto.slice(0, LIMITES.opcion), esCorrecta: tipo === 'ordenar' || o.esCorrecta }));
  if (tipo === 'vf') {
    if (correctas === 0)
      avisos.push(`Línea ${c.linea}: el verdadero o falso no tenía marcada la correcta; quedó "Falso". Tocá la correcta en la vista previa.`);
    const verdadera = c.opciones.find((o) => sinTildes(o.texto).startsWith('v'));
    opciones = opcionesVF(verdadera?.esCorrecta ?? !c.opciones.find((o) => sinTildes(o.texto).startsWith('f'))?.esCorrecta);
  }
  const max = maxOpciones(tipo);
  if (opciones.length > max) {
    avisos.push(`Línea ${c.linea}: tenía ${opciones.length} ${tipo === 'ordenar' ? 'pasos' : 'opciones'}; quedaron las primeras ${max}.`);
    opciones = opciones.slice(0, max);
  }
  if (c.texto.length > LIMITES.pregunta) avisos.push(`Línea ${c.linea}: la pregunta era muy larga y se recortó a ${LIMITES.pregunta} letras.`);
  const p = { tipo, texto: c.texto.slice(0, LIMITES.pregunta), imagen: null, tiempoSeg: c.tiempoSeg, multiplicador: c.multiplicador, opciones };
  return { ...p, linea: c.linea, problemas: problemasPregunta(p) };
}

/** JSON con la forma de un quiz ({ titulo, preguntas: [...] }) o solo la lista de preguntas. */
function desdeJson(datos: unknown): ResultadoImportar {
  const avisos: string[] = [];
  const obj = (Array.isArray(datos) ? { preguntas: datos } : datos) as { titulo?: unknown; preguntas?: unknown };
  const lista = Array.isArray(obj.preguntas) ? obj.preguntas : [];
  if (lista.length === 0) avisos.push('El JSON no tiene una lista "preguntas".');
  const preguntas = lista.map((x, i): PreguntaImportada => {
    const q = (x ?? {}) as Record<string, unknown>;
    const opcionesCrudas = Array.isArray(q.opciones) ? q.opciones : [];
    const tipo = ALIAS_TIPO[sinTildes(String(q.tipo ?? ''))] ?? null;
    const c: Crudo = {
      linea: i + 1,
      texto: String(q.texto ?? q.pregunta ?? '').trim(),
      tipo,
      tiempoSeg: tiempoCercano(Number(q.tiempoSeg ?? q.tiempo ?? tiempoInicial(tipo ?? 'multiple')) || 20),
      tiempoDado: true,
      multiplicador: ([0, 1, 2] as const).find((m) => m === Number(q.multiplicador ?? 1)) ?? 1,
      opciones: opcionesCrudas.map((o) =>
        typeof o === 'string'
          ? { texto: o, esCorrecta: false }
          : { texto: String((o as { texto?: unknown }).texto ?? ''), esCorrecta: (o as { esCorrecta?: unknown }).esCorrecta === true },
      ),
      numeradas: 0,
    };
    if (c.tipo === 'ordenar') c.numeradas = c.opciones.length;
    return armar(c, avisos);
  });
  return { titulo: typeof obj.titulo === 'string' && obj.titulo.trim() ? obj.titulo.trim().slice(0, LIMITES.titulo) : null, preguntas, avisos };
}

/** Lo que se le pega a la IA para que devuelva preguntas en este formato. */
export function instruccionesParaIA(tema = '[escribí acá el tema y para qué curso es]'): string {
  return `Armame preguntas para un quiz de clase sobre: ${tema}

Devolvé SOLO las preguntas dentro de un bloque de código (\`\`\`), sin explicaciones antes ni después, en este formato:

# Título del quiz
? Texto de la pregunta (hasta ${LIMITES.pregunta} letras)
tiempo: 20
* Opción correcta
- Opción incorrecta
- Opción incorrecta
- Opción incorrecta

Reglas:
- Cada pregunta empieza con "?" en una línea nueva.
- Opciones: "*" adelante para la correcta y "-" para las incorrectas. Entre ${LIMITES.minOpciones} y ${LIMITES.maxOpciones} opciones, de hasta ${LIMITES.opcion} letras cada una.
- Si hay más de una correcta, marcalas todas con "*" (el alumno tiene que marcar todas).
- Verdadero o falso: dos opciones, "Verdadero" y "Falso", con "*" en la correcta.
- Ordenar pasos: en vez de opciones, de ${LIMITES.minPasos} a ${LIMITES.maxPasos} pasos numerados en el orden correcto ("1. …", "2. …").
- "tiempo:" es opcional y puede ser ${TIEMPOS_SEG.join(', ')} (segundos). Por defecto, 20.
- "puntos: doble" es opcional, para alguna pregunta difícil.
- Carrera de tipeo (opcional, para cortar entre preguntas): una línea "tipo: tipeo" y, en la línea del "?", la frase que los alumnos tienen que tipear (de ${LIMITES.minTipeo} a ${LIMITES.pregunta} letras, sobre el tema). No lleva opciones.
- Escribí en español rioplatense (voseo), con preguntas claras y opciones incorrectas creíbles.

Ejemplo:

# Atajos de teclado
? ¿Qué atajo copia lo seleccionado?
* Ctrl + C
- Ctrl + V
- Ctrl + X
- Ctrl + Z

? Ctrl + Z deshace la última acción.
* Verdadero
- Falso

? ¿Cuáles de estos atajos sirven para guardar o imprimir?
tiempo: 30
* Ctrl + S
* Ctrl + P
- Ctrl + A
- Ctrl + F

? Ctrl + S guarda el archivo y Ctrl + P lo manda a imprimir.
tipo: tipeo

? Ordená los pasos para guardar un archivo con otro nombre.
1. Abrir el menú Archivo
2. Elegir "Guardar como"
3. Escribir el nombre nuevo
4. Hacer clic en Guardar`;
}

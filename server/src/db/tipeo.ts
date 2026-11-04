import { LIMITES_TIPEO, normalizarTexto, type TextoTipeo } from '@aula/shared';
import { db } from './index';

interface FilaTexto {
  id: number;
  titulo: string;
  texto: string;
  creado_en: string;
}

const aTexto = (f: FilaTexto): TextoTipeo => ({ id: f.id, titulo: f.titulo, texto: f.texto, creadoEn: f.creado_en });

export function listarTextos(): TextoTipeo[] {
  return db.prepare<[], FilaTexto>('SELECT * FROM textos_tipeo ORDER BY id').all().map(aTexto);
}

export function buscarTexto(id: number): TextoTipeo | null {
  const f = db.prepare<[number], FilaTexto>('SELECT * FROM textos_tipeo WHERE id = ?').get(id);
  return f ? aTexto(f) : null;
}

/** Valida y limpia un texto que manda el profe. Devuelve un mensaje si algo no va. */
export function validarTexto(datos: { titulo?: unknown; texto?: unknown }): { titulo: string; texto: string } | string {
  const titulo = typeof datos.titulo === 'string' ? datos.titulo.trim().replace(/\s+/g, ' ') : '';
  const texto = typeof datos.texto === 'string' ? normalizarTexto(datos.texto) : '';
  if (!titulo) return 'Ponele un título.';
  if (titulo.length > LIMITES_TIPEO.titulo) return `El título puede tener hasta ${LIMITES_TIPEO.titulo} letras.`;
  if (texto.length < LIMITES_TIPEO.minTexto) return `El texto tiene que tener al menos ${LIMITES_TIPEO.minTexto} letras.`;
  if (texto.length > LIMITES_TIPEO.texto) return `El texto puede tener hasta ${LIMITES_TIPEO.texto} letras (tiene ${texto.length}).`;
  return { titulo, texto };
}

export function crearTexto(t: { titulo: string; texto: string }): TextoTipeo {
  const { lastInsertRowid } = db.prepare('INSERT INTO textos_tipeo (titulo, texto) VALUES (?, ?)').run(t.titulo, t.texto);
  return buscarTexto(Number(lastInsertRowid))!;
}

export function editarTexto(id: number, t: { titulo: string; texto: string }): TextoTipeo | null {
  db.prepare('UPDATE textos_tipeo SET titulo = ?, texto = ? WHERE id = ?').run(t.titulo, t.texto, id);
  return buscarTexto(id);
}

export function borrarTexto(id: number): void {
  db.prepare('DELETE FROM textos_tipeo WHERE id = ?').run(id);
}

/** Mejor marca (ppm) de cada alumno antes de esta carrera. */
export function mejoresMarcas(alumnoIds: number[], antesDeCarrera: number): Map<number, number> {
  const marcas = new Map<number, number>();
  const stmt = db.prepare<[number, number], { mejor: number | null }>(
    'SELECT MAX(ppm) AS mejor FROM tipeo_resultados WHERE alumno_id = ? AND carrera_id < ? AND avance > 0',
  );
  for (const id of alumnoIds) {
    const m = stmt.get(id, antesDeCarrera)?.mejor;
    if (m !== null && m !== undefined) marcas.set(id, m);
  }
  return marcas;
}

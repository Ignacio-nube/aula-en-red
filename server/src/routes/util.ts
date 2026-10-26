import type { Response } from 'express';

export function idDe(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Recorta espacios y colapsa los repetidos. Devuelve null si queda vacío o es muy largo. */
export function textoLimpio(valor: unknown, max = 60): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim().replace(/\s+/g, ' ');
  return t.length > 0 && t.length <= max ? t : null;
}

export function error(res: Response, status: number, mensaje: string): void {
  res.status(status).json({ error: mensaje });
}

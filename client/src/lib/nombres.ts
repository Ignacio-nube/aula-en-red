/**
 * Nombre corto para la pantalla grande: el primer nombre, salvo que alguien más lo comparta
 * (dos "Juan", o "Bot 1" y "Bot 2"); en ese caso, el nombre completo.
 */
export function nombresCortos(lista: { id: number; nombre: string }[]): Map<number, string> {
  const primero = (n: string) => n.trim().split(/\s+/)[0] ?? n;
  const cuenta = new Map<string, number>();
  for (const a of lista) cuenta.set(primero(a.nombre).toLowerCase(), (cuenta.get(primero(a.nombre).toLowerCase()) ?? 0) + 1);
  return new Map(lista.map((a) => [a.id, (cuenta.get(primero(a.nombre).toLowerCase()) ?? 0) > 1 ? a.nombre : primero(a.nombre)]));
}

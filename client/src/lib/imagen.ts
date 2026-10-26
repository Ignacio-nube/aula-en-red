/** Lado más largo con el que se guardan las imágenes: alcanza para la TV y pesa poco en la red. */
const LADO_MAXIMO = 1600;

/**
 * Achica la imagen en el navegador antes de subirla (las fotos de celular pesan varios MB).
 * Los GIF se suben tal cual para no perder la animación.
 */
export async function prepararImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elegí un archivo de imagen (PNG, JPG, WEBP o GIF).');
  if (archivo.type === 'image/gif') {
    if (archivo.size > 6 * 1024 * 1024) throw new Error('El GIF es muy pesado (máximo 6 MB).');
    return archivo;
  }

  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error('No se pudo leer esa imagen. Probá con otra.');
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // PNG se queda en PNG (capturas con texto, transparencias); el resto pasa a WEBP.
  const tipo = archivo.type === 'image/png' ? 'image/png' : 'image/webp';
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, 0.85));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  // Si achicarla no ganó nada (por ejemplo, un PNG chico), se sube el original.
  return blob.size < archivo.size || escala < 1 ? blob : archivo;
}

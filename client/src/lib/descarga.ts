import { CLAVES, leer } from './almacen';
import { ErrorApi } from './api';

/** Baja un archivo de la API del profe (por ejemplo, un CSV) y lo guarda con el nombre que manda el servidor. */
export async function descargar(ruta: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, { headers: { Authorization: `Bearer ${leer(CLAVES.tokenProfe) ?? ''}` } });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor.', 0);
  }
  if (!res.ok) {
    const datos = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ErrorApi(datos?.error ?? 'No se pudo descargar.', res.status);
  }
  const disposicion = res.headers.get('Content-Disposition') ?? '';
  const nombre = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(disposicion)?.[1] ?? 'datos.csv');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

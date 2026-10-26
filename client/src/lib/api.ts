export class ErrorApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function api<T>(ruta: string, { method = 'GET', body, token }: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = {};
  // Un Blob (por ejemplo, una imagen) viaja crudo con su tipo; el resto, como JSON.
  const esArchivo = body instanceof Blob;
  if (body !== undefined) headers['Content-Type'] = esArchivo ? body.type : 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method,
      headers,
      body: body === undefined ? undefined : esArchivo ? body : JSON.stringify(body),
    });
  } catch {
    throw new ErrorApi('No hay conexión con la compu del profe. Revisá que estés en la misma red.', 0);
  }

  const datos = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ErrorApi(datos?.error ?? 'Algo falló. Probá de nuevo.', res.status);
  return datos as T;
}

export function mensajeDe(err: unknown): string {
  return err instanceof Error ? err.message : 'Algo falló. Probá de nuevo.';
}

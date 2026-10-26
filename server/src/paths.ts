import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tanto `src/` (dev con tsx) como `dist/` (build) están un nivel abajo de `server/`.
export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_DIR = path.resolve(SERVER_DIR, '..');
// Se pueden cambiar por variables de entorno para correr una instancia de prueba aparte.
export const CLIENT_DIST = process.env.AULA_CLIENT_DIST
  ? path.resolve(process.env.AULA_CLIENT_DIST)
  : path.join(ROOT_DIR, 'client', 'dist');

export const DATA_DIR = process.env.AULA_DATA_DIR ? path.resolve(process.env.AULA_DATA_DIR) : path.join(SERVER_DIR, 'data');
export const DB_PATH = path.join(DATA_DIR, 'app.db');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const PRESENTACIONES_DIR = path.join(DATA_DIR, 'presentaciones');

export function crearCarpetasDeDatos(): void {
  for (const dir of [DATA_DIR, UPLOADS_DIR, PRESENTACIONES_DIR]) mkdirSync(dir, { recursive: true });
}

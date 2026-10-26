import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, SERVER_DIR } from './paths';

// Prioridad: variables de entorno (.env) > server/config.json > valores por defecto.
for (const archivo of [path.join(SERVER_DIR, '.env'), path.join(ROOT_DIR, '.env')]) {
  if (existsSync(archivo)) process.loadEnvFile(archivo);
}

interface ConfigArchivo {
  pin?: string | number;
  puerto?: number;
}

function leerConfigJson(): ConfigArchivo {
  const archivo = path.join(SERVER_DIR, 'config.json');
  if (!existsSync(archivo)) return {};
  try {
    return JSON.parse(readFileSync(archivo, 'utf8')) as ConfigArchivo;
  } catch (err) {
    console.warn(`⚠️  No se pudo leer ${archivo}: ${(err as Error).message}`);
    return {};
  }
}

const json = leerConfigJson();

export const PIN_POR_DEFECTO = '1234';
export const PIN_PROFE = String(process.env.PROFE_PIN ?? json.pin ?? PIN_POR_DEFECTO).trim();
export const PUERTO = Number(process.env.PORT ?? json.puerto ?? 3000);
export const PRODUCCION = process.env.NODE_ENV === 'production';

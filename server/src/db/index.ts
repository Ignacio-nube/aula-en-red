import Database from 'better-sqlite3';
import type { ConfigPublica, NivelPassword } from '@aula/shared';
import { NIVELES } from '@aula/shared';
import { crearCarpetasDeDatos, DB_PATH } from '../paths';
import { MIGRACIONES } from './migraciones';

crearCarpetasDeDatos();

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 3000');

function migrar(): void {
  const actual = db.pragma('user_version', { simple: true }) as number;
  if (actual >= MIGRACIONES.length) return;
  // Sin claves foráneas mientras se recrean tablas (si no, borrar una tabla borra en cascada
  // las filas que la referencian). Se revisa todo al final, antes de volver a prenderlas.
  db.pragma('foreign_keys = OFF');
  try {
    for (let v = actual; v < MIGRACIONES.length; v++) {
      db.transaction(() => {
        db.exec(MIGRACIONES[v]!);
        const rotas = db.pragma('foreign_key_check') as unknown[];
        if (rotas.length > 0) throw new Error(`La migración ${v + 1} dejó referencias rotas.`);
        db.pragma(`user_version = ${v + 1}`);
      })();
      console.log(`  · Base de datos: migración ${v + 1} aplicada`);
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Corre antes de preparar cualquier consulta, para que las tablas ya existan.
migrar();

// --- config (clave/valor) ---------------------------------------------------

const DEFAULTS: ConfigPublica = {
  nombreCurso: 'Informática · Punto Digital',
  nivelMinimoPassword: 'media',
  modoRanking: 'todos',
  bonusRacha: true,
};

const stmtGet = db.prepare<[string], { valor: string }>('SELECT valor FROM config WHERE clave = ?');
const stmtSet = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');

function leer(clave: string): string | undefined {
  return stmtGet.get(clave)?.valor;
}

export function getConfig(): ConfigPublica {
  const nivel = leer('nivelMinimoPassword') as NivelPassword | undefined;
  const modo = leer('modoRanking');
  const bonus = leer('bonusRacha');
  return {
    nombreCurso: leer('nombreCurso') ?? DEFAULTS.nombreCurso,
    nivelMinimoPassword: nivel && NIVELES.includes(nivel) ? nivel : DEFAULTS.nivelMinimoPassword,
    modoRanking: modo === 'top3' || modo === 'todos' ? modo : DEFAULTS.modoRanking,
    bonusRacha: bonus === undefined ? DEFAULTS.bonusRacha : bonus === 'true',
  };
}

export function setConfig(cambios: Partial<ConfigPublica>): ConfigPublica {
  db.transaction(() => {
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor !== undefined) stmtSet.run(clave, String(valor));
    }
  })();
  return getConfig();
}

// --- estado interno (no es configuración del profe) -----------------------------
// Por ejemplo, la presentación en vivo, para retomarla si se reinicia el servidor.

export function leerEstado<T>(clave: string): T | null {
  const valor = leer(`estado:${clave}`);
  if (valor === undefined) return null;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return null;
  }
}

export function guardarEstado(clave: string, valor: unknown): void {
  if (valor === null) db.prepare('DELETE FROM config WHERE clave = ?').run(`estado:${clave}`);
  else stmtSet.run(`estado:${clave}`, JSON.stringify(valor));
}

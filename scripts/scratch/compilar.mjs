#!/usr/bin/env node
// Compila el editor de Scratch (TurboWarp) para el Taller de Scratch y baja su biblioteca de
// disfraces, fondos y sonidos, así anda sin internet. Se corre en casa, con internet:
//
//   npm run scratch:compilar                  todo (la primera vez tarda 10 a 20 minutos)
//   npm run scratch:compilar -- --biblioteca  solo baja lo que falte de la biblioteca
//
// Resultado (no va al repo, está en .gitignore):
//   scratch/editor/      el editor compilado, que el servidor sirve en /scratch
//   scratch/biblioteca/  los archivos de la biblioteca (<md5>.<ext>)
//   scratch/.fuente/     el código de TurboWarp (se puede borrar después; se vuelve a bajar)
//
// Para actualizar TurboWarp: cambiar COMMIT (y revisar que los PARCHES sigan aplicando).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/TurboWarp/scratch-gui.git';
/** Commit de la rama develop de TurboWarp/scratch-gui. */
const COMMIT = '2655574e4f8fce7283fe8de4cb6bb9d2d1c69c15';
/** De dónde se bajan los archivos de la biblioteca (el mismo servidor que usa Scratch). */
const HOST_BIBLIOTECA = 'https://assets.scratch.mit.edu/internalapi/asset';
/** La ruta en la que el servidor de Aula en Red sirve el editor (ver server/src/index.ts). */
const RUTA = '/scratch/';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(RAIZ, 'scratch');
const FUENTE = path.join(DIR, '.fuente');
const EDITOR = path.join(DIR, 'editor');
const BIBLIOTECA = path.join(DIR, 'biblioteca');

/**
 * Cambios al código de TurboWarp para que no pida nada a internet. Cada `buscar` tiene que aparecer
 * tal cual: si TurboWarp lo cambió, el script se frena y avisa (mejor eso que un editor que se cuelga
 * en el aula esperando a un servidor que no responde).
 */
const PARCHES = [
  {
    archivo: 'src/playground/render-interface.jsx',
    porque:
      'TurboWarp no muestra el editor dentro de un iframe (para que otros sitios no embeban turbowarp.org). ' +
      'Acá el iframe es de Aula en Red, del mismo origen: se permite solo en ese caso.',
    buscar: 'const isInvalidEmbed = window.parent !== window;',
    poner:
      'const isInvalidEmbed = window.parent !== window && (() => {\n' +
      '    try {\n' +
      '        return window.parent.location.origin !== window.location.origin;\n' +
      '    } catch (e) {\n' +
      '        return true;\n' +
      '    }\n' +
      '})(); // Aula en Red: se permite embeber desde el mismo origen',
  },
  {
    archivo: 'src/lib/project-fetcher-hoc.jsx',
    porque: 'Los disfraces y sonidos de la biblioteca se piden al servidor del aula, no a assets.scratch.mit.edu.',
    buscar: "assetHost: 'https://assets.scratch.mit.edu',",
    poner: "assetHost: process.env.ROOT + 'biblioteca',",
  },
  {
    archivo: 'src/containers/library-item.jsx',
    porque: 'Las miniaturas de la biblioteca, también desde el servidor del aula.',
    buscar: '`https://cdn.assets.scratch.mit.edu/internalapi/asset/${iconMd5}/get/`',
    poner: '`${process.env.ROOT}biblioteca/internalapi/asset/${iconMd5}/get/`',
  },
  {
    archivo: 'src/containers/extension-library.jsx',
    porque: 'La galería de extensiones de extensions.turbowarp.org necesita internet: no se pide.',
    buscar: "const res = await fetch('https://extensions.turbowarp.org/generated-metadata/extensions-v0.json');",
    poner: 'const res = {ok: true, json: () => Promise.resolve({extensions: []})}; // Aula en Red: sin internet',
  },
  {
    archivo: 'src/containers/extension-library.jsx',
    porque: 'Sin galería, tampoco el link "ver más extensiones".',
    buscar: 'library.push(toLibraryItem(galleryMore));',
    poner: '// Aula en Red: sin la galería online',
  },
  {
    archivo: 'src/lib/libraries/extensions/index.jsx',
    porque:
      'Se esconden las extensiones que necesitan internet (Traducir, Texto a voz, Detección de caras) o un programa ' +
      'aparte (Scratch Link para micro:bit, LEGO y Vernier).',
    buscar: '\nexport default [\n',
    poner:
      "\nconst SIN_INTERNET = ['faceSensing', 'text2speech', 'translate', 'microbit', 'ev3', 'boost', 'wedo2', 'gdxfor'];\n" +
      'export default [\n',
  },
  {
    archivo: 'src/lib/libraries/extensions/index.jsx',
    porque: 'Cierre del filtro de arriba.',
    buscar: '\n];\n\nexport const galleryLoading',
    poner: '\n].filter(e => !SIN_INTERNET.includes(e.extensionId));\n\nexport const galleryLoading',
  },
  {
    archivo: 'src/playground/render-gui.jsx',
    porque: 'Sin el botón "Ver página del proyecto": lleva a la portada de TurboWarp, que pide proyectos destacados a internet.',
    buscar: '        enableCommunity\n',
    poner: '        enableCommunity={false}\n',
  },
  {
    archivo: 'src/components/menu-bar/menu-bar.jsx',
    porque: 'Sin el botón "Feedback de TurboWarp" (es un link a scratch.mit.edu).',
    buscar: '{/* tw: add a feedback button */}\n                    <div className={styles.menuBarItem}>',
    poner: '{/* tw: add a feedback button (Aula en Red: no se muestra) */}\n                    {false && <div className={styles.menuBarItem}>',
  },
  {
    archivo: 'src/components/menu-bar/menu-bar.jsx',
    porque: 'Cierre del parche de arriba.',
    buscar: '                        </a>\n                    </div>\n                </div>\n\n                <div className={styles.accountInfoGroup}>',
    poner: '                        </a>\n                    </div>}\n                </div>\n\n                <div className={styles.accountInfoGroup}>',
  },
  {
    archivo: 'src/playground/render-gui.jsx',
    porque: 'Variables en la nube: no hay servidor de nube en el aula.',
    buscar: "|| 'wss://clouddata.turbowarp.org'",
    poner: "|| ''",
  },
];

function paso(texto) {
  console.log(`\n▸ ${texto}`);
}

// En Windows, npm es un .cmd y hay que correrlo con la consola. Los argumentos son todos fijos
// (nada que venga de afuera), así que alcanza con juntarlos en un solo comando.
const comando = (cmd, args) => [cmd, ...args].join(' ');

function correr(cmd, args, opciones = {}) {
  const r = spawnSync(comando(cmd, args), { stdio: 'inherit', shell: true, ...opciones });
  if (r.status !== 0) throw new Error(`Falló: ${comando(cmd, args)}`);
}

function salida(cmd, args, cwd) {
  const r = spawnSync(comando(cmd, args), { cwd, encoding: 'utf8', shell: true });
  return r.status === 0 ? r.stdout.trim() : null;
}

// --- 1. el código de TurboWarp, en el commit fijado ----------------------------------------------

function bajarFuente() {
  paso(`Código de TurboWarp (${COMMIT.slice(0, 10)})`);
  if (!existsSync(path.join(FUENTE, '.git'))) {
    mkdirSync(FUENTE, { recursive: true });
    correr('git', ['init', '-q'], { cwd: FUENTE });
    correr('git', ['remote', 'add', 'origin', REPO], { cwd: FUENTE });
  }
  if (salida('git', ['rev-parse', 'HEAD'], FUENTE) !== COMMIT) {
    correr('git', ['fetch', '-q', '--depth', '1', 'origin', COMMIT], { cwd: FUENTE });
  }
  // Deja el código como vino (sin parches de una corrida anterior).
  correr('git', ['checkout', '-q', '--force', COMMIT], { cwd: FUENTE });
  correr('git', ['clean', '-q', '-fd', '--', 'src'], { cwd: FUENTE });
}

function instalar() {
  const lock = createHash('sha256').update(readFileSync(path.join(FUENTE, 'package-lock.json'))).digest('hex');
  const marca = path.join(FUENTE, 'node_modules', '.aula-lock');
  if (existsSync(marca) && readFileSync(marca, 'utf8') === lock) {
    paso('Dependencias de TurboWarp: ya están');
    return;
  }
  paso('Dependencias de TurboWarp (npm ci, unos minutos)');
  correr('npm', ['ci', '--no-audit', '--no-fund'], { cwd: FUENTE });
  writeFileSync(marca, lock);
}

function parchear() {
  paso('Parches para que funcione sin internet');
  for (const p of PARCHES) {
    const ruta = path.join(FUENTE, p.archivo);
    const texto = readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
    const veces = texto.split(p.buscar).length - 1;
    if (veces !== 1) {
      throw new Error(
        `El parche de ${p.archivo} no aplica (el texto aparece ${veces} veces). Probablemente TurboWarp cambió ese archivo: ` +
          `revisalo y actualizá PARCHES en scripts/scratch/compilar.mjs.\n  Buscado: ${p.buscar}`,
      );
    }
    writeFileSync(ruta, texto.replace(p.buscar, p.poner));
    console.log(`  ✓ ${p.archivo}: ${p.porque}`);
  }
}

function compilar() {
  paso('Compilando el editor (webpack, puede tardar varios minutos)');
  correr('npm', ['run', 'build'], {
    cwd: FUENTE,
    env: { ...process.env, NODE_ENV: 'production', ROOT: RUTA, CI: 'true', NODE_OPTIONS: '--max-old-space-size=6144' },
  });
  // Se reemplaza recién cuando terminó bien: si falla, queda el editor anterior.
  const nuevo = path.join(DIR, 'editor.nuevo');
  rmSync(nuevo, { recursive: true, force: true });
  cpSync(path.join(FUENTE, 'build'), nuevo, { recursive: true });
  rmSync(EDITOR, { recursive: true, force: true });
  renameSync(nuevo, EDITOR);
  // La licencia y la marca de Scratch viajan con el editor.
  for (const f of ['LICENSE', 'TRADEMARK']) cpSync(path.join(FUENTE, f), path.join(DIR, f));
}

/** Busca en el editor compilado cualquier pedido a internet que se haya escapado de los parches. */
function revisarHosts() {
  paso('Revisando que el editor no apunte a servidores de afuera');
  // (clouddata.turbowarp.org sigue apareciendo en una lista de nombres para mostrar; la conexión ya la apaga el parche.)
  const prohibidos = ['assets.scratch.mit.edu/internalapi', 'extensions.turbowarp.org/generated-metadata'];
  const js = path.join(EDITOR, 'js');
  const encontrados = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSyncSeguro(dir)) {
      const ruta = path.join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (nombre.endsWith('.js')) {
        const texto = readFileSync(ruta, 'utf8');
        for (const p of prohibidos) if (texto.includes(p)) encontrados.push(`${path.relative(EDITOR, ruta)}: ${p}`);
      }
    }
  };
  recorrer(js);
  if (encontrados.length) throw new Error(`Quedaron referencias a internet en el editor:\n  ${encontrados.join('\n  ')}`);
  console.log('  ✓ Nada de assets.scratch.mit.edu ni de la galería de extensiones');
}

function readdirSyncSeguro(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}

// --- 2. la biblioteca ---------------------------------------------------------------------------------

function archivosDeBiblioteca() {
  const leer = (n) => JSON.parse(readFileSync(path.join(FUENTE, 'src', 'lib', 'libraries', `${n}.json`), 'utf8'));
  const todos = new Set();
  for (const n of ['costumes', 'backdrops', 'sounds']) for (const i of leer(n)) todos.add(i.md5ext);
  for (const s of leer('sprites')) for (const a of [...(s.costumes ?? []), ...(s.sounds ?? [])]) todos.add(a.md5ext);
  return [...todos].filter((m) => /^[a-f0-9]{32}\.[a-z0-9]+$/.test(m));
}

const md5 = (datos) => createHash('md5').update(datos).digest('hex');

async function bajarUno(md5ext) {
  const destino = path.join(BIBLIOTECA, md5ext);
  const esperado = md5ext.split('.')[0];
  if (existsSync(destino) && md5(readFileSync(destino)) === esperado) return 'ya';
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await fetch(`${HOST_BIBLIOTECA}/${md5ext}/get/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = Buffer.from(await res.arrayBuffer());
      if (md5(datos) !== esperado) throw new Error('el archivo llegó dañado');
      writeFileSync(destino, datos);
      return 'bajado';
    } catch (err) {
      if (intento === 4) throw new Error(`${md5ext}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * intento));
    }
  }
}

async function bajarBiblioteca() {
  const lista = archivosDeBiblioteca();
  paso(`Biblioteca de disfraces, fondos y sonidos (${lista.length} archivos)`);
  mkdirSync(BIBLIOTECA, { recursive: true });
  const cuenta = { ya: 0, bajado: 0 };
  const fallas = [];
  let i = 0;
  const trabajador = async () => {
    while (i < lista.length) {
      const m = lista[i++];
      try {
        cuenta[await bajarUno(m)]++;
      } catch (err) {
        fallas.push(err.message);
      }
      const hechos = cuenta.ya + cuenta.bajado + fallas.length;
      if (hechos % 100 === 0 || hechos === lista.length) process.stdout.write(`  ${hechos}/${lista.length}\r`);
    }
  };
  await Promise.all(Array.from({ length: 16 }, trabajador));
  console.log(`\n  ✓ ${cuenta.bajado} bajados, ${cuenta.ya} ya estaban`);
  if (fallas.length) throw new Error(`No se pudieron bajar ${fallas.length} archivos (volvé a correr el script para reintentar):\n  ${fallas.slice(0, 10).join('\n  ')}`);
}

function pesoDe(dir) {
  let total = 0;
  for (const nombre of readdirSyncSeguro(dir)) {
    const ruta = path.join(dir, nombre);
    const s = statSync(ruta);
    total += s.isDirectory() ? pesoDe(ruta) : s.size;
  }
  return total;
}

// --- main ----------------------------------------------------------------------------------------------

const soloBiblioteca = process.argv.includes('--biblioteca');
try {
  const inicio = Date.now();
  if (!soloBiblioteca) {
    bajarFuente();
    instalar();
    parchear();
    compilar();
    revisarHosts();
  } else if (!existsSync(path.join(FUENTE, 'src'))) {
    bajarFuente();
  }
  await bajarBiblioteca();
  writeFileSync(
    path.join(DIR, 'VERSION.json'),
    JSON.stringify({ editor: 'TurboWarp/scratch-gui', repo: REPO, commit: COMMIT, compilado: new Date().toISOString() }, null, 2) + '\n',
  );
  const mb = (b) => `${(b / 1024 / 1024).toFixed(0)} MB`;
  console.log(`\n✅ Listo en ${Math.round((Date.now() - inicio) / 1000)} s. Editor: ${mb(pesoDe(EDITOR))}, biblioteca: ${mb(pesoDe(BIBLIOTECA))}.`);
  console.log('   Reiniciá el servidor (o iniciar.bat) para que lo tome.\n');
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}

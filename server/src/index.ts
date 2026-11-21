import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { PIN_POR_DEFECTO, PIN_PROFE, PUERTO } from './config';
import './db';
import { CLIENT_DIST, PRESENTACIONES_DIR, SCRATCH_DIR, UPLOADS_DIR } from './paths';
import { borrarSesionesVencidas } from './auth';
import { limpiarDrivesHuerfanos } from './db/drive';
import { restaurarActividad } from './actividades/control';
import { iniciarRealtime } from './realtime';
import { alumno } from './routes/alumno';
import { csv } from './routes/csv';
import { drive } from './routes/drive';
import { info, urlsLocales } from './routes/info';
import { presentaciones } from './routes/presentaciones';
import { profe } from './routes/profe';
import { quizzes } from './routes/quizzes';
import { resultados } from './routes/resultados';
import { scratch } from './routes/scratch';
import { tipeo } from './routes/tipeo';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api', info, alumno, profe, quizzes, presentaciones, csv, resultados, tipeo, drive, scratch);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta inexistente.' });
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1h' }));
// Cada PDF subido tiene un nombre único y no cambia nunca: se cachea para siempre, así las
// compus de los alumnos lo bajan una sola vez. express.static responde pedidos por rangos,
// que pdf.js usa para mostrar la primera diapositiva sin esperar el archivo entero.
app.use('/presentaciones', express.static(PRESENTACIONES_DIR, { maxAge: '365d', immutable: true }));

// Editor de Scratch (TurboWarp compilado con `npm run scratch:compilar`). Va en un iframe del mismo
// origen, así la app puede cargarle el proyecto y sacarle el .sb3 para entregar.
const EDITOR_SCRATCH = path.join(SCRATCH_DIR, 'editor');
const BIBLIOTECA_SCRATCH = path.join(SCRATCH_DIR, 'biblioteca');
const hayScratch = existsSync(path.join(EDITOR_SCRATCH, 'editor.html'));
// Disfraces, fondos y sonidos de la biblioteca: el editor los pide como a assets.scratch.mit.edu,
// pero acá. Se identifican por su MD5, así que no cambian nunca.
app.get('/scratch/biblioteca/internalapi/asset/:archivo/get/', (req, res) => {
  const archivo = req.params.archivo;
  if (!/^[a-f0-9]{32}\.(svg|png|jpg|jpeg|bmp|gif|wav|mp3)$/i.test(archivo)) return void res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(BIBLIOTECA_SCRATCH, archivo.toLowerCase()), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
app.use(
  '/scratch',
  express.static(EDITOR_SCRATCH, {
    index: false,
    setHeaders: (res, archivo) => {
      // Los JS de TurboWarp llevan hash en el nombre; las páginas, no.
      if (archivo.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      else if (archivo.includes(`${path.sep}js${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);
app.use('/scratch', (_req, res) => {
  res.status(hayScratch ? 404 : 503).type('html').send(
    `<!doctype html><meta charset="utf-8"><body data-falta-scratch style="font-family:system-ui;padding:2rem;color:#3C3C3B">` +
      (hayScratch
        ? '<h1>No se encontró ese archivo del editor de Scratch.</h1>'
        : '<h1>Falta compilar el editor de Scratch</h1><p>En la notebook del profe, con internet, corré <code>npm run scratch:compilar</code> y reiniciá el servidor.</p>'),
  );
});

// Build del cliente. Los assets de Vite llevan hash en el nombre: se pueden cachear para siempre.
const hayBuild = existsSync(path.join(CLIENT_DIST, 'index.html'));
if (hayBuild) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, archivo) => {
        if (archivo.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  // Rutas de la SPA (/, /profe, /pantalla): siempre index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.includes('.')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

const manejarError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: 'Datos inválidos.' });
  if (err?.type === 'entity.too.large') return void res.status(413).json({ error: 'El archivo es demasiado pesado.' });
  res.status(500).json({ error: 'Algo falló en el servidor. Probá de nuevo.' });
};
app.use(manejarError);

const http = createServer(app);
iniciarRealtime(http);
restaurarActividad();
// Las sesiones de alumno vencidas no sirven más: se borran al arrancar y cada hora.
borrarSesionesVencidas();
limpiarDrivesHuerfanos();
setInterval(borrarSesionesVencidas, 60 * 60 * 1000).unref();

http.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ El puerto ${PUERTO} ya está en uso. ¿Quedó otra ventana de Aula en Red abierta? Cerrala y probá de nuevo.\n`);
    process.exit(1);
  }
  throw err;
});

http.listen(PUERTO, '0.0.0.0', () => {
  const urls = urlsLocales();
  console.log('\n  Aula en Red · Punto Digital\n');
  if (urls.length === 0) {
    console.log('  ⚠️  No se encontró ninguna red. Conectá la notebook al WiFi, al router o al hotspot.');
  } else {
    console.log('  Los alumnos entran desde el navegador a:');
    for (const url of urls) console.log(`    ${url}`);
  }
  console.log(`\n  Profe:     http://localhost:${PUERTO}/profe`);
  console.log(`  Pantalla:  http://localhost:${PUERTO}/pantalla\n`);
  if (PIN_PROFE === PIN_POR_DEFECTO) {
    console.log(`  ⚠️  El PIN del profe es el de fábrica (${PIN_POR_DEFECTO}). Cambialo en server/config.json o en .env (PROFE_PIN).\n`);
  }
  if (!hayScratch) console.log('  ℹ️  No está el editor de Scratch (scratch/editor). Para el Taller de Scratch, corré "npm run scratch:compilar".\n');
  if (!hayBuild) console.log('  ℹ️  No hay build del cliente (client/dist). Corré "npm run build" o usá "npm run dev".\n');
});

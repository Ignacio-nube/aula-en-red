import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { PIN_POR_DEFECTO, PIN_PROFE, PUERTO } from './config';
import './db';
import { CLIENT_DIST, PRESENTACIONES_DIR, UPLOADS_DIR } from './paths';
import { iniciarRealtime } from './realtime';
import { alumno } from './routes/alumno';
import { csv } from './routes/csv';
import { info, urlsLocales } from './routes/info';
import { presentaciones } from './routes/presentaciones';
import { profe } from './routes/profe';
import { quizzes } from './routes/quizzes';
import { resultados } from './routes/resultados';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api', info, alumno, profe, quizzes, presentaciones, csv, resultados);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta inexistente.' });
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1h' }));
// Cada PDF subido tiene un nombre único y no cambia nunca: se cachea para siempre, así las
// compus de los alumnos lo bajan una sola vez. express.static responde pedidos por rangos,
// que pdf.js usa para mostrar la primera diapositiva sin esperar el archivo entero.
app.use('/presentaciones', express.static(PRESENTACIONES_DIR, { maxAge: '365d', immutable: true }));

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
  if (!hayBuild) console.log('  ℹ️  No hay build del cliente (client/dist). Corré "npm run build" o usá "npm run dev".\n');
});

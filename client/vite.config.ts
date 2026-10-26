import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const servidor = 'http://localhost:3000';

/**
 * Archivos que pdf.js baja a pedido: tablas de caracteres (cmaps), las 14 fuentes estándar de PDF
 * y los decodificadores en WebAssembly para algunas imágenes. Van en /pdfjs/ dentro del build,
 * así un PDF raro se ve bien aunque no haya internet.
 */
function recursosPdfjs(): Plugin {
  const raiz = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const carpetas = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  let salida = '';
  return {
    name: 'aula:recursos-pdfjs',
    configResolved(config) {
      salida = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const relativo = decodeURIComponent((req.url ?? '').split('?')[0]!);
        const archivo = path.join(raiz, relativo);
        if (!archivo.startsWith(raiz) || !carpetas.some((c) => relativo.startsWith(`/${c}/`))) return next();
        if (!existsSync(archivo) || !statSync(archivo).isFile()) return next();
        if (archivo.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        createReadStream(archivo).pipe(res);
      });
    },
    closeBundle() {
      for (const c of carpetas) cpSync(path.join(raiz, c), path.join(salida, 'pdfjs', c), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), recursosPdfjs()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Solo para desarrollo en casa. En el aula se usa el build servido por Express.
    proxy: {
      '/api': servidor,
      '/uploads': servidor,
      '/presentaciones': servidor,
      '/socket.io': { target: servidor, ws: true },
    },
  },
  build: {
    // Navegadores de las PCs del aula: Chrome/Edge relativamente nuevos, pero no asumir lo último.
    target: 'es2020',
    // pdf.js pesa ~600 kB, pero se sirve desde la notebook por la red local y queda en caché.
    chunkSizeWarningLimit: 700,
  },
});

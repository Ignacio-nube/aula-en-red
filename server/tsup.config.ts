import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // `shared` se empaqueta adentro; las dependencias reales quedan en node_modules.
  noExternal: ['@aula/shared'],
  external: ['better-sqlite3'],
});

# Editor de Scratch (TurboWarp)

Esta carpeta tiene el editor de Scratch que usa el **Taller de Scratch** de Aula en Red. El servidor lo sirve en `/scratch`.

El editor es [TurboWarp](https://turbowarp.org), una versión de Scratch 3 que corre los proyectos más rápido, algo importante en las compus viejas del aula. Su interfaz es la misma de Scratch, en español.

## Qué hay acá

| Archivo o carpeta | Qué es | ¿Va al repo? |
|---|---|---|
| `LEEME.md` | Este archivo | Sí |
| `LICENSE` | Licencia de TurboWarp (GPL-3.0) | Sí |
| `TRADEMARK` | Aviso sobre las marcas de Scratch (del MIT) | Sí |
| `editor/` | El editor compilado | No: se genera |
| `biblioteca/` | Disfraces, fondos y sonidos de la biblioteca de Scratch (~1.300 archivos) | No: se baja |
| `.fuente/` | El código de TurboWarp, para compilar | No: se baja |
| `VERSION.json` | Qué commit se compiló y cuándo | No: se genera |

Estas carpetas no van al repo y se arman con un solo comando:

- `editor/`, unos 25 MB.
- `biblioteca/`, unos 55 MB.
- `.fuente/`, con las dependencias de TurboWarp, unos 550 MB.

El comando es:

```bash
npm run scratch:compilar
```

Se corre en casa, con internet, como `npm install`. El script está en `scripts/scratch/compilar.mjs`.

## Licencia y código fuente

- **TurboWarp/scratch-gui** se distribuye bajo la **GNU GPL v3** (ver `LICENSE`).
  - El código fuente exacto que se compila es el commit indicado en `COMMIT`, dentro de `scripts/scratch/compilar.mjs`, del repositorio <https://github.com/TurboWarp/scratch-gui>.
  - A ese código se le aplican solo los cambios listados en `PARCHES`, en el mismo script. Sirven para que no pida nada a internet.
- El editor corre aparte, dentro de un iframe. Aula en Red no incluye su código: solo lo sirve y le pasa proyectos.
- **Scratch** es un proyecto del Scratch Foundation, en colaboración con el Lifelong Kindergarten Group del MIT Media Lab. Las marcas de Scratch son del MIT (ver `TRADEMARK`). Aula en Red no está avalada por ellos.
- Los disfraces, fondos y sonidos de la biblioteca son los de Scratch, que se bajan de `assets.scratch.mit.edu`.

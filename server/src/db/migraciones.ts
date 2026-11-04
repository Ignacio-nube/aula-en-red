// Migraciones en orden. Cada una corre una sola vez; la versión aplicada se guarda
// en `PRAGMA user_version`. Para cambiar el esquema, agregar una nueva al final:
// nunca editar una que ya corrió en el aula.
export const MIGRACIONES: readonly string[] = [
  /* 1: esquema inicial */ `
  CREATE TABLE comisiones (
    id      INTEGER PRIMARY KEY,
    nombre  TEXT NOT NULL
  );

  CREATE TABLE alumnos (
    id             INTEGER PRIMARY KEY,
    comision_id    INTEGER NOT NULL REFERENCES comisiones(id) ON DELETE CASCADE,
    nombre         TEXT NOT NULL,
    avatar         TEXT NOT NULL,
    password_hash  TEXT,
    creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX alumnos_comision ON alumnos(comision_id);

  CREATE TABLE quizzes (
    id              INTEGER PRIMARY KEY,
    titulo          TEXT NOT NULL,
    descripcion     TEXT NOT NULL DEFAULT '',
    creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE preguntas (
    id             INTEGER PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    orden          INTEGER NOT NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('multiple', 'vf')),
    texto          TEXT NOT NULL,
    imagen         TEXT,
    tiempo_seg     INTEGER NOT NULL DEFAULT 20,
    multiplicador  INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX preguntas_quiz ON preguntas(quiz_id, orden);

  CREATE TABLE opciones (
    id           INTEGER PRIMARY KEY,
    pregunta_id  INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
    orden        INTEGER NOT NULL,
    texto        TEXT NOT NULL,
    es_correcta  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX opciones_pregunta ON opciones(pregunta_id, orden);

  CREATE TABLE sesiones (
    id              INTEGER PRIMARY KEY,
    quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    comision_id     INTEGER NOT NULL REFERENCES comisiones(id) ON DELETE CASCADE,
    iniciada_en     TEXT NOT NULL DEFAULT (datetime('now')),
    finalizada_en   TEXT
  );

  CREATE TABLE respuestas (
    id           INTEGER PRIMARY KEY,
    sesion_id    INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    pregunta_id  INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
    alumno_id    INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    opcion_id    INTEGER REFERENCES opciones(id) ON DELETE SET NULL,
    correcta     INTEGER NOT NULL DEFAULT 0,
    tiempo_ms    INTEGER NOT NULL,
    puntos       INTEGER NOT NULL DEFAULT 0,
    UNIQUE (sesion_id, pregunta_id, alumno_id)
  );

  CREATE TABLE presentaciones (
    id         INTEGER PRIMARY KEY,
    titulo     TEXT NOT NULL,
    archivo    TEXT NOT NULL,
    paginas    INTEGER NOT NULL,
    creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE config (
    clave  TEXT PRIMARY KEY,
    valor  TEXT NOT NULL
  );

  -- Sesiones abiertas: profe (por PIN) y alumnos (por contraseña).
  CREATE TABLE tokens (
    token      TEXT PRIMARY KEY,
    rol        TEXT NOT NULL CHECK (rol IN ('profe', 'alumno')),
    alumno_id  INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX tokens_alumno ON tokens(alumno_id);
  `,

  /* 2: juego en vivo. Sesiones con una copia del quiz (para que editarlo o borrarlo después
        no cambie el historial) y respuestas sin FK a preguntas/opciones por lo mismo.
        En la Fase 1 estas dos tablas no se usaban: se pueden recrear sin perder nada. */ `
  DROP TABLE respuestas;
  DROP TABLE sesiones;

  CREATE TABLE sesiones (
    id              INTEGER PRIMARY KEY,
    quiz_id         INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
    comision_id     INTEGER NOT NULL REFERENCES comisiones(id) ON DELETE CASCADE,
    quiz_json       TEXT NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
    -- Índice de la última pregunta cerrada (jugada o salteada). -1 = ninguna.
    ultima_cerrada  INTEGER NOT NULL DEFAULT -1,
    bonus_racha     INTEGER NOT NULL DEFAULT 0,
    iniciada_en     TEXT NOT NULL DEFAULT (datetime('now')),
    finalizada_en   TEXT
  );
  CREATE INDEX sesiones_comision ON sesiones(comision_id);

  CREATE TABLE sesion_alumnos (
    sesion_id  INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    alumno_id  INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    PRIMARY KEY (sesion_id, alumno_id)
  );

  CREATE TABLE respuestas (
    id           INTEGER PRIMARY KEY,
    sesion_id    INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    pregunta_id  INTEGER NOT NULL,  -- id dentro de sesiones.quiz_json
    alumno_id    INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    opcion_id    INTEGER,           -- NULL = no respondió a tiempo
    correcta     INTEGER NOT NULL DEFAULT 0,
    tiempo_ms    INTEGER NOT NULL,
    puntos       INTEGER NOT NULL DEFAULT 0,
    UNIQUE (sesion_id, pregunta_id, alumno_id)
  );
  CREATE INDEX respuestas_sesion ON respuestas(sesion_id, pregunta_id);
  `,

  /* 3: Fase 4. Dos tipos de pregunta nuevos (varias correctas y ordenar pasos), respuestas con
        varias opciones (respuesta_json: ids elegidos, o el orden armado) y encuestas rápidas.
        "preguntas" se recrea para ampliar el CHECK del tipo (SQLite no deja modificarlo); las
        claves foráneas están apagadas durante las migraciones, así no se borran las opciones. */ `
  CREATE TABLE preguntas_nueva (
    id             INTEGER PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    orden          INTEGER NOT NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('multiple', 'vf', 'varias', 'ordenar')),
    texto          TEXT NOT NULL,
    imagen         TEXT,
    tiempo_seg     INTEGER NOT NULL DEFAULT 20,
    multiplicador  INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO preguntas_nueva (id, quiz_id, orden, tipo, texto, imagen, tiempo_seg, multiplicador)
    SELECT id, quiz_id, orden, tipo, texto, imagen, tiempo_seg, multiplicador FROM preguntas;
  DROP TABLE preguntas;
  ALTER TABLE preguntas_nueva RENAME TO preguntas;
  CREATE INDEX preguntas_quiz ON preguntas(quiz_id, orden);

  ALTER TABLE respuestas ADD COLUMN respuesta_json TEXT;

  CREATE TABLE encuestas (
    id               INTEGER PRIMARY KEY,
    comision_id      INTEGER REFERENCES comisiones(id) ON DELETE SET NULL,
    comision_nombre  TEXT NOT NULL,
    pregunta         TEXT NOT NULL,
    tipo             TEXT NOT NULL CHECK (tipo IN ('opciones', 'escala', 'texto')),
    opciones_json    TEXT NOT NULL,
    anonima          INTEGER NOT NULL DEFAULT 1,
    creada_en        TEXT NOT NULL DEFAULT (datetime('now')),
    cerrada_en       TEXT
  );

  -- En las anónimas, al cerrarlas se borra alumno_id: queda solo la respuesta.
  CREATE TABLE encuesta_respuestas (
    id           INTEGER PRIMARY KEY,
    encuesta_id  INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    alumno_id    INTEGER REFERENCES alumnos(id) ON DELETE SET NULL,
    valor        TEXT NOT NULL,
    UNIQUE (encuesta_id, alumno_id)
  );
  CREATE INDEX encuesta_respuestas_encuesta ON encuesta_respuestas(encuesta_id);
  `,
  /* 4: Actualización 1. Quiz por equipos (cuántos equipos tuvo la sesión y en cuál jugó cada uno)
        y carreras de tipeo: textos para practicar, cada carrera y el resultado de cada alumno. */ `
  ALTER TABLE sesiones ADD COLUMN equipos INTEGER;
  ALTER TABLE sesion_alumnos ADD COLUMN equipo INTEGER;

  CREATE TABLE textos_tipeo (
    id         INTEGER PRIMARY KEY,
    titulo     TEXT NOT NULL,
    texto      TEXT NOT NULL,
    creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE tipeo_carreras (
    id               INTEGER PRIMARY KEY,
    comision_id      INTEGER REFERENCES comisiones(id) ON DELETE SET NULL,
    comision_nombre  TEXT NOT NULL,
    titulo           TEXT NOT NULL,
    texto            TEXT NOT NULL,
    iniciada_en      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE tipeo_resultados (
    id          INTEGER PRIMARY KEY,
    carrera_id  INTEGER NOT NULL REFERENCES tipeo_carreras(id) ON DELETE CASCADE,
    alumno_id   INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    ppm         REAL NOT NULL,
    precision   REAL NOT NULL,
    avance      REAL NOT NULL,
    completo    INTEGER NOT NULL DEFAULT 0,
    tiempo_ms   INTEGER NOT NULL,
    UNIQUE (carrera_id, alumno_id)
  );
  CREATE INDEX tipeo_resultados_alumno ON tipeo_resultados(alumno_id);

  INSERT INTO textos_tipeo (titulo, texto) VALUES
    ('Para arrancar', 'El teclado es la herramienta que más usamos en la compu. Si aprendemos a escribir sin mirar las teclas, vamos a ganar tiempo en todo lo que hagamos.'),
    ('Las partes de la compu', 'Una computadora tiene partes que se pueden tocar, como el monitor, el teclado y el mouse. Eso se llama hardware. Los programas que usamos se llaman software.'),
    ('Guardar a tiempo', 'Mientras hacés un trabajo, guardalo seguido. Con Ctrl y la letra S se guarda en un segundo. Si se corta la luz, no perdés lo que escribiste.'),
    ('Contraseñas seguras', 'Una buena contraseña es larga y mezcla letras, números y símbolos. No uses tu nombre ni tu fecha de cumpleaños, y nunca se la digas a nadie.'),
    ('La nube', 'Guardar archivos en la nube significa guardarlos en una computadora de otra empresa, conectada a internet. Así podés abrirlos desde el celu o desde cualquier compu.'),
    ('Correo electrónico', 'Para mandar un correo necesitás la dirección de la otra persona, un asunto que cuente de qué se trata y un mensaje claro. Antes de enviarlo, leelo una vez más.'),
    ('Buscar en internet', 'Para buscar bien, usá pocas palabras y bien elegidas. Mirá de qué página viene cada resultado y compará con otras fuentes antes de creer lo que dice.'),
    ('Atajos que sirven', 'Ctrl más C copia, Ctrl más V pega y Ctrl más Z deshace. Con Alt y Tab cambiás de ventana. Los atajos parecen difíciles, pero después no los vas a querer dejar.'),
    ('Las redes', 'Una red une varias computadoras para que compartan archivos, impresoras o la conexión a internet. En el aula, todas las compus están en la misma red.'),
    ('El cuidado del equipo', 'No comas ni tomes cerca de la compu. Apagala desde el menú y no con el botón. Si algo no anda, avisá antes de tocar los cables. Así el equipo dura mucho más.');
  `,
  /* 5: Carrera de tipeo como pregunta del quiz. Se recrea "preguntas" para sumar 'tipeo' al CHECK
        (igual que en la 3; las claves foráneas están apagadas, así no se borran las opciones). */ `
  CREATE TABLE preguntas_nueva (
    id             INTEGER PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    orden          INTEGER NOT NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('multiple', 'vf', 'varias', 'ordenar', 'tipeo')),
    texto          TEXT NOT NULL,
    imagen         TEXT,
    tiempo_seg     INTEGER NOT NULL DEFAULT 20,
    multiplicador  INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO preguntas_nueva (id, quiz_id, orden, tipo, texto, imagen, tiempo_seg, multiplicador)
    SELECT id, quiz_id, orden, tipo, texto, imagen, tiempo_seg, multiplicador FROM preguntas;
  DROP TABLE preguntas;
  ALTER TABLE preguntas_nueva RENAME TO preguntas;
  CREATE INDEX preguntas_quiz ON preguntas(quiz_id, orden);
  `,
  /* 6: Para que el alumno pudiera cambiarse el nombre (se guardaba el de la lista). Al final el alumno
        cambia solo su emoji y la columna quedó sin uso; no se borra para no tocar bases ya migradas. */ `
  ALTER TABLE alumnos ADD COLUMN nombre_anterior TEXT;
  `,
  /* 7: Simulador de Drive (la unidad de cada alumno) y votación de dibujos con caritas. Las imágenes
        de una galería se copian a uploads/ al empezar: borrarlas del Drive no rompe el historial. */ `
  CREATE TABLE drive_items (
    id                 INTEGER PRIMARY KEY,
    alumno_id          INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    padre_id           INTEGER REFERENCES drive_items(id) ON DELETE CASCADE,
    tipo               TEXT NOT NULL CHECK (tipo IN ('carpeta', 'archivo')),
    nombre             TEXT NOT NULL,
    mime               TEXT,
    tamano             INTEGER NOT NULL DEFAULT 0,
    archivo            TEXT,
    destacado          INTEGER NOT NULL DEFAULT 0,
    compartido         INTEGER NOT NULL DEFAULT 0,
    en_papelera_desde  TEXT,
    creado_en          TEXT NOT NULL DEFAULT (datetime('now')),
    modificado_en      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX drive_items_alumno ON drive_items(alumno_id);

  CREATE TABLE galerias (
    id               INTEGER PRIMARY KEY,
    comision_id      INTEGER REFERENCES comisiones(id) ON DELETE SET NULL,
    comision_nombre  TEXT NOT NULL,
    titulo           TEXT NOT NULL,
    mostrar_autor    TEXT NOT NULL,
    creada_en        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE galeria_imagenes (
    id          INTEGER PRIMARY KEY,
    galeria_id  INTEGER NOT NULL REFERENCES galerias(id) ON DELETE CASCADE,
    alumno_id   INTEGER REFERENCES alumnos(id) ON DELETE SET NULL,
    nombre      TEXT NOT NULL,
    archivo     TEXT NOT NULL,
    orden       INTEGER NOT NULL
  );
  CREATE INDEX galeria_imagenes_galeria ON galeria_imagenes(galeria_id, orden);

  CREATE TABLE galeria_votos (
    imagen_id  INTEGER NOT NULL REFERENCES galeria_imagenes(id) ON DELETE CASCADE,
    alumno_id  INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    valor      INTEGER NOT NULL CHECK (valor BETWEEN 1 AND 5),
    PRIMARY KEY (imagen_id, alumno_id)
  );
  `,
];

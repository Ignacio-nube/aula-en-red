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
];

# Aula en Red · Punto Digital: especificación del proyecto

App para dar clases de informática en los cursos de **Punto Digital**, en una red local **sin internet**. Incluye quizzes en vivo estilo Kahoot, presentaciones sincronizadas y herramientas de participación. La usa un profesor con 3 comisiones de 8 alumnos (adolescentes).

Toda la interfaz va en **español rioplatense** (voseo: "Elegí tu nombre", "Respondé").

---

## 1. Contexto y restricciones (leer primero)

- **Funciona 100% offline.** La red local puede ser el WiFi del Punto Digital, un router propio o el hotspot de un celular, sin acceso a internet.
  - **Prohibido** cargar cualquier recurso externo: CDNs, Google Fonts, imágenes remotas, analytics.
  - Todo va empaquetado en el proyecto. Las fuentes se incluyen con `@fontsource`, los íconos con `lucide-react`, y pdf.js con su worker incluido en el build.
- **Un solo servidor** corre en la notebook del profesor. Todos (profesor, alumnos y proyector) usan la app **desde el navegador**. No hay nada que instalar en las PCs de los alumnos.
- **PCs de alumnos:** Windows 10, Intel i5 de generaciones viejas, pantallas probablemente de **1366×768**. La interfaz tiene que verse bien y fluir en esa resolución.
- **Pantalla grande o TV** conectada por HDMI a la notebook del profesor. Muestra una vista dedicada.
- **No hay datos sensibles.** La seguridad es básica a propósito, pero las contraseñas se guardan hasheadas, porque esto también es material didáctico (ver sección 5).
- El desarrollo y `npm install` se hacen en casa, con internet. En el aula se usa el **build de producción**, nunca el dev server de Vite.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui |
| Animaciones | Motion (ex Framer Motion), `canvas-confetti` para el podio |
| PDF | pdf.js (`pdfjs-dist`), con el worker empaquetado localmente |
| Backend | Node + Express + Socket.IO + TypeScript |
| Base de datos | SQLite con `better-sqlite3` (SQL directo, con migraciones simples) |
| Contraseñas | `bcryptjs` (versión JS pura, sin compilación nativa) |
| QR para unirse | `qrcode` (generado localmente, sin servicios externos) |

**Componentes de UI:**
- Para los componentes de UI estándar (Dialog, Select, Switch, Tabs, Sonner, DropdownMenu, etc.), usar la **skill oficial de shadcn**, con sus estilos reemplazados por los tokens de la sección 3.
- Los componentes lúdicos (botones de respuesta, podio, temporizador, medidor de contraseñas, sala de espera) se hacen **a medida** con Tailwind y Motion, siguiendo la skill **frontend-design**.

**Estructura sugerida:** monorepo con `client/`, `server/` y `shared/`. En `shared/` van los tipos de los eventos de Socket.IO y de los modelos, compartidos entre cliente y servidor.

- El servidor escucha en `0.0.0.0:3000` y sirve el build de `client/` como archivos estáticos.
- Los datos van en `server/data/`: `app.db`, `uploads/` (imágenes de preguntas) y `presentaciones/` (PDFs).
- El logo va en `client/public/brand/` (se copia desde la carpeta `brand/` de la raíz del proyecto).

---

## 3. Diseño visual: identidad Punto Digital con estilo iOS

El objetivo es una app moderna y familiar para los chicos, que a la vez se reconozca como parte de Punto Digital.

### 3.1 Identidad de marca

- **Logo:** pin (marcador de mapa) celeste con un círculo blanco adentro y el texto "Punto" (regular) / "**Digital**" (bold) en gris oscuro. El archivo está en `brand/`.
  - **No redibujarlo ni modificarlo.** Usar siempre el archivo original.
  - Respetar su espacio libre alrededor.
  - Usarlo en: pantalla de ingreso del alumno, encabezado de `/profe`, pantalla de inicio y podio de `/pantalla`.
- **Paleta base.** Valores aproximados tomados del logo; reemplazarlos por los oficiales si se consiguen:

  | Token | Valor | Uso |
  |---|---|---|
  | `--pd-celeste` | `#3AB6E6` | color principal: fondos de acento, íconos, bordes activos, progreso, pin |
  | `--pd-celeste-oscuro` | `#0B7DB0` | botones con texto blanco, links, foco (para cumplir el contraste mínimo) |
  | `--pd-celeste-claro` | `#EAF7FD` | fondos suaves, tarjetas seleccionadas, sala de espera |
  | `--pd-gris-texto` | `#3C3C3B` | texto principal (gris del logo, en vez de negro puro) |
  | `--pd-gris-medio` | `#7A7A7A` | texto secundario |
  | `--pd-fondo` | `#F6F8FA` | fondo general claro estilo iOS |

- **Contraste:** el texto blanco sobre `--pd-celeste` **no** cumple el contraste mínimo de accesibilidad (WCAG AA).
  - Para botones con texto blanco, usar `--pd-celeste-oscuro`.
  - Sobre celeste claro, usar texto gris oscuro.
- **El pin como motivo visual recurrente**, usado con moderación:
  - Loader de la sala de espera: un pin que rebota suave.
  - Marco de los avatares de los alumnos.
  - Marcador de "levantó la mano".
  - Los puestos del podio, coronados con un pin.

### 3.2 Estilo iOS

- **Tipografía:** Inter (vía `@fontsource/inter`), con pesos marcados en los títulos (combina con el "Digital" en bold del logo).
- **Formas:** bordes muy redondeados (16–24 px en tarjetas, botones tipo píldora), sombras suaves y mucho espacio en blanco.
- **Materiales:** fondos tipo vidrio esmerilado (`backdrop-blur`) en barras y modales, sobre fondos con degradés suaves en celeste claro y blanco.
- **Animaciones:** transiciones con física de resorte (spring) de Motion. También:
  - Botones que se "hunden" levemente al tocarlos.
  - Entradas escalonadas en listas.
  - Contadores animados de puntaje.

### 3.3 Botones de respuesta del quiz

- 4 colores vivos que armonizan con el celeste, cada uno con un **ícono de forma** además del color (por accesibilidad). La paleta es propia, no copiada de Kahoot:

  | Respuesta | Color | Forma |
  |---|---|---|
  | A | celeste Punto Digital, en su tono oscuro (`#0B7DB0`) | círculo |
  | B | coral (`#F25F5C`) | triángulo |
  | C | amarillo (`#F5B700`), con texto gris oscuro | rombo |
  | D | verde (`#2BB673`) | cuadrado |

- En Verdadero/Falso: verde para Verdadero, coral para Falso.

### 3.4 Otros

- **Solo modo claro en v1,** pero con todos los colores definidos como tokens CSS para poder agregar modo oscuro después.
- **Modo liviano:** un interruptor (guardado en `localStorage`) que desactiva el blur y reduce las animaciones. Por defecto también se respeta `prefers-reduced-motion`.

---

## 4. Vistas

### `/` Alumno
1. Pantalla de bienvenida con el logo de Punto Digital. Elegir comisión.
2. Elegir su nombre de la lista (con avatar o emoji dentro del marco de pin).
3. Contraseña:
   - Si es la primera vez, o si el profe la restauró, **crea** su contraseña con el medidor de fortaleza (sección 5).
   - Si no, la ingresa.
4. **Sala de espera** animada ("Esperando al profe…"), con el pin rebotando.
5. Durante la clase, la pantalla del alumno sigue lo que esté pasando: quiz, presentación o espera.

### `/profe` Panel del profesor (protegido con PIN)
- El PIN se define en `server/config.json` o en `.env`. Por defecto, `1234`, y se avisa en consola que conviene cambiarlo.
- Secciones:
  - **Comisiones y alumnos:** crear, editar y borrar. Carga rápida pegando una lista de nombres. Botón **"Restaurar contraseña"** por alumno.
  - **Quizzes:** listado y editor (sección 6).
  - **Presentaciones:** subir PDF, listado.
  - **Clase en vivo:** elegir comisión, iniciar un quiz o una presentación, y controlar lo que sucede.
  - **Resultados:** historial (sección 8).

### `/pantalla` Vista para la pantalla grande
- **Sin sesión activa:** logo de Punto Digital, nombre del curso, IP para unirse en grande y **código QR**.
- **Sala de espera:** alumnos conectados, que aparecen con animación al entrar.
- **Durante el quiz:**
  - Pregunta, imagen, temporizador grande y contador "5/8 respondieron".
  - Luego, la distribución de respuestas y la correcta.
  - Luego, el ranking.
- **Podio final** animado (3.º, 2.º y 1.º apareciendo en ese orden) con confetti en los colores de la marca.
- **Durante una presentación:** la diapositiva actual a pantalla completa.
- La música o los sonidos suenan **solo** en esta vista, nunca en las notebooks de los alumnos.

---

## 5. Contraseñas con medidor didáctico

En el curso se enseña a crear contraseñas seguras, así que la pantalla de creación es parte de la clase.

- **Medidor en vivo** mientras el alumno escribe, con una **carita animada** que cambia de expresión según el nivel:

  | Nivel | Carita | Color |
  |---|---|---|
  | Débil | 😟 | rojo |
  | Media | 😐 | amarillo |
  | Fuerte | 😄 | verde |
  | Muy fuerte | 🤩 | celeste Punto Digital |

- **Checklist animado** de criterios, que se van tildando con un pequeño rebote:
  - 8 o más caracteres
  - Mayúscula
  - Minúscula
  - Número
  - Símbolo
  - No es una contraseña común
  - No contiene tu nombre
- Lista local de contraseñas comunes, con unas 100 entradas incluidas en el código: `123456`, `password`, `contraseña`, `qwerty`, `river`, `boca`, `puntodigital`, etc.
- Mensajes con onda y en voseo. Por ejemplo: "¡Esa la adivina cualquiera!", "Vas bien, sumale un símbolo", "¡Imposible de hackear! 💪".
- **Nivel mínimo para aceptar:** configurable por el profe. Por defecto, "Media".
- Campo de confirmación, más un botón de "ojito" para mostrar u ocultar.
- **En el servidor:** se guarda solo el hash (bcryptjs).
  - "Restaurar contraseña" borra el hash, y el alumno crea una nueva en su próximo ingreso.
  - El profe **nunca** ve las contraseñas. Esto es intencional y se puede explicar en clase.
- La sesión del alumno se mantiene con un token en `localStorage`, para no pedir la contraseña en cada recarga.

---

## 6. Editor de quizzes (estilo Kahoot)

- Un quiz tiene título, descripción opcional y una lista de preguntas **reordenables** (arrastrar y soltar).
- Cada pregunta tiene:
  - **Tipo:**
    - Opción múltiple: de 2 a 4 opciones. Una correcta en v1; varias correctas en v2.
    - Verdadero/Falso.
  - **Texto** de la pregunta.
  - **Imagen opcional** (subida local, guardada en `uploads/`).
  - **Tiempo:** 5, 10, 20, 30, 60, 90 o 120 segundos.
  - **Puntos:** normal, doble o sin puntos.
- Vista previa de cómo se ve la pregunta en la pantalla del alumno.
- Duplicar y borrar quizzes y preguntas.
- Guardado automático (o un botón claro de guardar, con aviso si hay cambios sin guardar).

---

## 7. Juego en vivo

### Flujo
1. **Sala de espera.**
2. **Cuenta regresiva** "3, 2, 1".
3. **Pregunta y respuesta.** Los alumnos ven la pregunta y los botones grandes de colores.
4. **Resultado de la pregunta.** Cada alumno ve feedback personal, por ejemplo "¡Correcto! +850" o "¡Uy! Era la B", más su racha si tiene.
5. **Ranking.**
6. **Siguiente pregunta**, y así hasta el **podio final**.

### Controles del profe
- Siguiente.
- Pausar o reanudar el temporizador.
- +10 segundos.
- Saltar pregunta.
- Terminar quiz.
- **Opción de ranking**, que se puede cambiar en cualquier momento: **mostrar todos** o **solo top 3**.

### Puntaje estilo Kahoot
- Respuesta correcta: `puntos = round(1000 × (1 − (tiempoRespuesta / tiempoTotal) / 2))`, multiplicado por 2 si la pregunta es doble y por 0 si es sin puntos.
- Respuesta incorrecta o sin responder: 0 puntos.
- Bonus opcional por racha de respuestas correctas, configurable.

### Reglas técnicas
- **El servidor es la autoridad** del estado y del tiempo.
  - Envía a los clientes el tiempo restante en milisegundos (no una hora absoluta, porque los relojes de las PCs pueden diferir).
  - El cliente anima localmente.
  - El servidor valida con su propio reloj y rechaza respuestas fuera de tiempo.
- **Reconexión:** si un alumno recarga o pierde la conexión, al volver recibe el estado actual completo y conserva sus puntos y respuestas.
- Un alumno responde una sola vez por pregunta.
- Todo se persiste en SQLite a medida que ocurre. Si el servidor se reinicia a mitad de un quiz, los datos ya respondidos no se pierden.

---

## 8. Resultados (dentro de la app)

- **Historial de sesiones:** fecha, comisión, quiz, ranking final, porcentaje de aciertos por pregunta (para detectar qué temas no se entendieron).
- **Por alumno:** sesiones en las que participó, puntajes y aciertos.
- Exportar a CSV queda para una versión futura.

---

## 9. Presentaciones sincronizadas

- El profe sube un **PDF** (exportado desde PowerPoint).
- Se renderiza con pdf.js en `/profe`, `/pantalla` y en las pantallas de los alumnos.
- El profe avanza o retrocede con botones o con las flechas del teclado, y todos los alumnos ven la misma diapositiva al instante.
- **Modo "libre" opcional:** permite a los alumnos navegar el PDF por su cuenta. Un botón "Volver con el profe" los resincroniza.
- Precarga de la diapositiva siguiente para que el cambio sea instantáneo.

---

## 10. Participación

- **Levantar la mano:** el alumno toca un botón con una manito animada.
  - Al profe le aparece una **cola ordenada**, marcada con el pin, con aviso visual y sonoro suave en `/profe`.
  - El profe la "baja" al atenderla, y el alumno puede bajarla solo.
- **(Fase 4)**
  - Botón "No entendí" o "Más despacio", con un contador anónimo para el profe.
  - Preguntas anónimas.
  - Encuesta rápida o ticket de salida.
  - Modo "Miren al frente": pantalla completa en el alumno con un mensaje. Es una herramienta de convivencia, no un bloqueo real.

---

## 11. Base de datos (punto de partida, se puede ajustar)

```
comisiones(id, nombre)
alumnos(id, comision_id, nombre, avatar, password_hash NULL, creado_en)
quizzes(id, titulo, descripcion, creado_en, actualizado_en)
preguntas(id, quiz_id, orden, tipo, texto, imagen NULL, tiempo_seg, multiplicador)
opciones(id, pregunta_id, orden, texto, es_correcta)
sesiones(id, quiz_id, comision_id, iniciada_en, finalizada_en NULL)
respuestas(id, sesion_id, pregunta_id, alumno_id, opcion_id NULL, correcta, tiempo_ms, puntos)
presentaciones(id, titulo, archivo, paginas, creado_en)
config(clave, valor)   -- PIN, nombre del curso, nivel mínimo de contraseña, modo ranking, etc.
```

---

## 12. Operación en el aula

- **`iniciar.bat`** en la raíz. Con doble clic:
  1. Arranca el servidor en producción.
  2. Muestra en consola las IPs locales de la máquina (por ejemplo `http://192.168.0.15:3000`).
  3. Abre `/profe` en el navegador.
- **`README.md`** con:
  - Instalación (en casa).
  - Cómo hacer el build.
  - Cómo permitir el puerto 3000 en el Firewall de Windows (con el comando `netsh` listo para copiar).
  - Cómo verificar desde otra PC que la red local funciona.
  - Qué hacer si el WiFi del Punto Digital tiene aislamiento de clientes: usar un router propio o el hotspot del celular.
- **Simulador de alumnos:** `npm run bots -- 8` conecta 8 alumnos falsos que responden al azar con demoras aleatorias. Sirve para probar todo en casa sin 8 notebooks.

---

## 13. Fases de desarrollo

Trabajar **una fase por vez**. Al terminar cada fase, la app tiene que compilar, andar, y haberse probado con el simulador de bots cuando aplique.

| Fase | Contenido | Listo cuando… |
|---|---|---|
| **1. Base** | Monorepo, servidor + Socket.IO + SQLite con migraciones, **sistema de diseño Punto Digital + iOS** (tokens, logo, componentes base, fuente local), PIN del profe, CRUD de comisiones y alumnos, login de alumno con **medidor de contraseñas**, sala de espera, `/pantalla` con logo + IP + QR, `iniciar.bat` | Desde otra PC de la red un alumno crea su contraseña, entra y aparece en `/pantalla` |
| **2. Quiz** | Editor de quizzes con imágenes, juego en vivo completo, temporizador, puntaje, ranking configurable (todos / top 3), podio con confetti, reconexión, resultados en la app, simulador de bots | Un quiz de 10 preguntas con 8 bots corre de punta a punta sin errores, y sobrevive a recargas de página |
| **3. Clase** | Presentaciones PDF sincronizadas (con modo libre), levantar la mano, modo liviano | El profe pasa diapositivas y los alumnos las ven al instante; la cola de manos funciona |
| **4. Extras** | "No entendí", preguntas anónimas, encuesta rápida, "Miren al frente", varias correctas, ordenar pasos, modo oscuro, exportar CSV | A definir |

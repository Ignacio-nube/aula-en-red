# Aula en Red · Punto Digital

App para dar clases de informática en una red local **sin internet**. Corre en la notebook del profe y todos (profe, alumnos y pantalla grande) la usan desde el navegador. La especificación completa está en [`PROYECTO.md`](PROYECTO.md).

| Quién | Dirección |
|---|---|
| Alumnos | `http://<IP-de-la-notebook>:3000` |
| Profe | `http://localhost:3000/profe` (PIN por defecto: `1234`) |
| Pantalla grande o TV | `http://localhost:3000/pantalla` |

## 1. Instalación (en casa, con internet)

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo. Conviene usar **la misma versión de Node en casa y en el aula**: `better-sqlite3` trae un binario compilado para la versión con la que se instaló.

```bash
npm install
npm run build
```

`npm run build` genera `client/dist` (la app web) y `server/dist` (el servidor). Eso es lo que se usa en el aula. Después de cambiar código, hay que volver a correrlo.

Para desarrollar en casa con recarga automática:

```bash
npm run dev     # servidor en :3000 + Vite en :5173 (abrir http://localhost:5173)
```

El dev server de Vite es solo para desarrollar. **En el aula se usa siempre el build.**

## 2. Cambiar el PIN del profe

Copiá `server/config.example.json` como `server/config.json` y cambiá el PIN:

```json
{ "pin": "4821" }
```

También se puede definir `PROFE_PIN=4821` en un archivo `.env`, en la raíz o en `server/`. Si queda el PIN `1234`, el servidor lo avisa al arrancar.

## 3. En el aula

1. Conectá la notebook a la red (WiFi del Punto Digital, router propio o hotspot del celular).
2. Hacé doble clic en **`iniciar.bat`**. Se abre una consola con las direcciones para los alumnos y, a los pocos segundos, el panel del profe.
3. Conectá la TV por HDMI y abrí `http://localhost:3000/pantalla` en esa ventana. Con el botón de la esquina inferior derecha se pone en pantalla completa. Desde el panel también se abre con el menú ☰ → *Abrir la vista de pantalla grande*.
4. Los alumnos escriben en su navegador la dirección que aparece en la pantalla grande, por ejemplo `192.168.0.15:3000`.

**No cierres la consola de `iniciar.bat`** mientras dure la clase: es el servidor.

Los datos quedan en `server/data/`: `app.db` (base de datos), `uploads/` y `presentaciones/`. Para hacer un backup, copiá esa carpeta con el servidor apagado.

### Un quiz en vivo

1. En **Quizzes**, creá el quiz. Las preguntas se reordenan arrastrando el ⠿, y las imágenes se pueden pegar con Ctrl+V. Para guardar, usá **Guardar** o Ctrl+S. Hay cuatro tipos de pregunta:
   - **Opción múltiple** (una correcta) y **Verdadero o falso**.
   - **Varias correctas**: el alumno marca todas las que crea y manda. Suma solo si marcó exactamente las correctas.
   - **Ordenar pasos**: escribís los pasos en el orden correcto; los alumnos los ven mezclados y los ordenan arrastrando o con las flechas.
2. En **Clase en vivo**, elegí la comisión y el quiz, y tocá **Abrir la sala de espera**. Los alumnos que ya entraron aparecen solos.
3. Avanzá con el botón grande o con la flecha → (también anda un presentador inalámbrico). Durante cada pregunta tenés **Pausar**, **+10 segundos**, **Saltar pregunta** y **Terminar quiz**. El ranking de la pantalla grande se puede cambiar en cualquier momento entre *Todos* y *Solo el top 3*.
4. Al terminar, los resultados quedan en **Resultados**, por quiz jugado y por alumno. Con **CSV** bajás una planilla que Excel abre con doble clic (una sesión, o **Todo en CSV** para armar notas).

Si un alumno recarga la página o se le corta el WiFi, vuelve al quiz donde estaba, con sus puntos. Si se apaga la notebook a mitad de un quiz, al volver a abrirlo aparece en **Clase en vivo → Quedaron sin terminar**, con la opción de retomarlo desde la última pregunta cerrada.

En la pantalla grande, tocá el parlante de la esquina inferior derecha para activar el sonido: el navegador solo deja reproducir audio después de un clic. Los sonidos salen solo por esa pantalla.

### Presentaciones

1. En **Presentaciones**, tocá **Subir PDF** o arrastrá los archivos a la página. Si la presentación es de PowerPoint, primero guardala como PDF (*Archivo → Exportar → PDF*). Quedan guardadas en la notebook (`server/data/presentaciones/`), listas para cualquier clase.
2. Para presentar, usá **Presentar en clase** desde la tarjeta, o andá a **Clase en vivo**, elegí *Presentación*, la comisión y el PDF.
3. Pasá las diapositivas con las flechas ← →, Av Pág / Re Pág, la barra espaciadora (anda con un presentador inalámbrico) o tocando una miniatura. Los alumnos y la pantalla grande cambian al instante: la siguiente diapositiva ya está dibujada de antemano.
4. Con **Modo libre**, cada alumno puede ir y volver por su cuenta. Mientras no se mueva, sigue al profe; si se mueve, le aparece **Volver con el profe**.

Mientras hay una presentación no se puede iniciar un quiz (y al revés): terminá una antes de empezar la otra. Si se reinicia la notebook en medio de una presentación, al volver sigue en la misma diapositiva.

### Participación de los alumnos

En la sala de espera y durante las presentaciones, cada alumno tiene:

- **Levantar la mano**: le aparece en qué lugar de la fila está.
- **🤔 No entendí** y **🐢 Más despacio**: avisos **anónimos**. Vos ves solo cuántos, nunca quién. Se borran solos a los 3 minutos, o con **Listo** cuando ya lo atendiste.
- **💬 Preguntar**: una pregunta **anónima** (ni vos sabés quién la mandó). Podés mostrarla en la pantalla grande para responderla para todos.

Todo eso aparece en el panel del profe, abajo a la izquierda, en cualquier pestaña: una pastilla con los contadores y quién sigue en la fila de manos. Tocala para ver el detalle (se cierra sola al tocar afuera). Con cada novedad suena un aviso suave; se silencia con la campanita.

### Herramientas de la clase

En **Clase en vivo → Herramientas de la clase**:

- **Miren al frente**: tapa la pantalla de los alumnos con un mensaje grande hasta que lo apagues. Es una herramienta de convivencia: no bloquea la compu.
- **Encuesta rápida o ticket de salida**: una pregunta para toda la clase, con opciones, con caritas (😣 a 🤩) o con texto libre. Mientras está abierta, los resultados los ves solo vos; al cerrarla se muestran en la pantalla grande y en las compus. Si es **anónima**, al cerrarla se borra quién respondió qué. Quedan guardadas en **Resultados → Encuestas** (también en CSV).

### Modo liviano y modo oscuro

**Modo liviano**, para compus lentas: saca el efecto de vidrio esmerilado, reduce las animaciones y dibuja las diapositivas a menor resolución. **Modo oscuro**: automático (como esté la compu), claro u oscuro. Los dos se eligen en cada compu por separado y quedan guardados ahí:

- **Alumnos:** los botones de la luna y la pluma, abajo a la derecha de la sala de espera.
- **Profe:** menú ☰ → *Tema* y *Modo liviano*.
- **Pantalla grande:** los mismos botones, en la esquina inferior derecha.

### Desde el celular

Todo se puede usar desde un celular conectado a la misma red. Los alumnos pueden entrar con el QR de la pantalla grande. El panel del profe tiene las secciones en una barra abajo, y durante una presentación muestra botones grandes de **Anterior / Siguiente**: sirve como control remoto mientras caminás por el aula.

## Probar en casa sin alumnos: simulador de bots

Con el servidor andando (`npm start` o `iniciar.bat`), en otra terminal:

```bash
npm run bots -- 8                     # 8 alumnos falsos en la comisión "Bots"
npm run bots -- 8 --caos              # además, cada tanto uno "recarga la página"
npm run bots -- 8 --manos             # además levantan la mano, mandan avisos y preguntas anónimas
npm run bots -- 8 --comision "Martes 14 h" --pin 4821
```

Los bots se crean solos (Bot 1, Bot 2…), entran a la sala de espera y responden al azar, con demoras aleatorias (también los tipos *Varias correctas* y *Ordenar pasos*, y las encuestas). Después iniciás un quiz, una presentación o una encuesta para esa comisión desde **Clase en vivo**. Con Ctrl+C se desconectan. Si no querés que queden en la lista, borrá la comisión "Bots".

## 4. Permitir el puerto 3000 en el Firewall de Windows

La primera vez, Windows puede preguntar si permite que Node use la red. Aceptá en **redes privadas**. Si no preguntó, o si los alumnos no pueden entrar, abrí una terminal **como administrador** y corré:

```bat
netsh advfirewall firewall add rule name="Aula en Red" dir=in action=allow protocol=TCP localport=3000 profile=private,public
```

Para borrar la regla más adelante:

```bat
netsh advfirewall firewall delete rule name="Aula en Red"
```

Revisá también que la red esté marcada como **privada** en *Configuración → Red e Internet → Propiedades*.

## 5. Probar que la red local funciona

Desde la PC de un alumno, o desde el celular conectado a la misma red:

1. Abrí `http://<IP>:3000` en el navegador. La IP es la que muestra la consola de `iniciar.bat`.
2. Si no carga, abrí una terminal en esa PC y corré `ping <IP>`:
   - **Si responde** pero la página no carga, es el firewall: volvé al punto 4.
   - **Si no responde**, las dos compus no se ven en la red: seguí con el punto 6.
3. Si la consola muestra varias IPs, probá con cada una. La primera suele ser la correcta. Las que empiezan con `192.168.56.` o `172.` suelen ser adaptadores virtuales (VirtualBox, WSL, Docker).

## 6. Si el WiFi del Punto Digital tiene "aislamiento de clientes"

Algunas redes públicas no dejan que los dispositivos se vean entre sí, aunque estén en el mismo WiFi. En ese caso el `ping` del punto 5 falla siempre. Hay dos opciones:

- **Router propio:** cualquier router hogareño sirve, sin necesidad de internet. Conectá la notebook y las PCs a ese WiFi.
- **Hotspot del celular:** activá la zona WiFi del celular y conectá ahí la notebook y las PCs. No consume datos, porque la app no usa internet. Con 8 alumnos algunos celulares llegan a su límite de dispositivos; revisalo antes de la clase.

En los dos casos la IP de la notebook cambia: usá la que muestre `iniciar.bat`. La pantalla grande se actualiza sola.

## Estructura

```
client/   Vite + React + Tailwind + shadcn/ui: vistas /, /profe y /pantalla
server/   Express + Socket.IO + SQLite (better-sqlite3)
shared/   Tipos y lógica compartida (eventos de Socket.IO, medidor de contraseñas)
brand/    Logo original de Punto Digital (se copia en client/public/brand/)
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor + cliente en modo desarrollo |
| `npm run build` | Build de producción de cliente y servidor |
| `npm start` | Corre el build (lo mismo que `iniciar.bat`, sin abrir el navegador) |
| `npm run typecheck` | Chequeo de tipos de los tres paquetes |

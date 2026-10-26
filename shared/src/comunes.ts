// Contraseñas que cualquiera prueba primero. Se comparan en minúsculas, sin tildes
// y con los reemplazos típicos (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s) deshechos.
export const CONTRASENAS_COMUNES: readonly string[] = [
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '1234', '123',
  '111111', '000000', '123123', '654321', '666666', '121212', '112233', '987654321',
  '147258369', '159753', '123321', '11111111', '00000000', '88888888', '999999',
  'password', 'passw0rd', 'pass', 'contrasena', 'contraseña', 'clave', 'micontrasena',
  'qwerty', 'qwerty123', 'asdfgh', 'asdf', 'zxcvbn', 'qwertyuiop', 'asdfghjkl', 'abc123',
  'abcdef', 'abcd1234', 'a1b2c3', 'admin', 'administrador', 'root', 'usuario', 'user',
  'login', 'welcome', 'bienvenido', 'hola', 'hola123', 'holamundo', 'test', 'prueba',
  'secreto', 'iloveyou', 'teamo', 'teamomucho', 'amor', 'princesa', 'tequiero', 'mama',
  'papa', 'familia', 'dios', 'jesus', 'angel', 'estrella', 'sol', 'luna', 'futbol',
  'football', 'soccer', 'messi', 'messi10', 'maradona', 'diego10', 'river', 'riverplate',
  'boca', 'bocajuniors', 'racing', 'independiente', 'sanlorenzo', 'argentina', 'campeon',
  'puntodigital', 'punto', 'digital', 'escuela', 'colegio', 'alumno', 'profe', 'compu',
  'computadora', 'internet', 'wifi', 'google', 'facebook', 'instagram', 'tiktok',
  'minecraft', 'fortnite', 'roblox', 'freefire', 'pokemon', 'naruto', 'goku', 'dragon',
  'superman', 'batman', 'spiderman', 'monkey', 'master', 'shadow', 'letmein', 'trustno1',
  'sunshine', 'charlie', 'perro', 'gato', 'michi', 'baseball', 'starwars',
];

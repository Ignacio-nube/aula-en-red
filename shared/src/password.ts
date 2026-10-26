// Evaluación de fortaleza de contraseñas. La usa el medidor del alumno (en vivo)
// y el servidor (para revalidar antes de guardar el hash).
import { CONTRASENAS_COMUNES } from './comunes';
import type { NivelPassword } from './types';

export const NIVELES: readonly NivelPassword[] = ['debil', 'media', 'fuerte', 'muy-fuerte'];

export const NOMBRE_NIVEL: Record<NivelPassword, string> = {
  debil: 'Débil',
  media: 'Media',
  fuerte: 'Fuerte',
  'muy-fuerte': 'Muy fuerte',
};

export type IdCriterio =
  | 'largo'
  | 'mayuscula'
  | 'minuscula'
  | 'numero'
  | 'simbolo'
  | 'noComun'
  | 'noNombre';

export const CRITERIOS: readonly { id: IdCriterio; texto: string }[] = [
  { id: 'largo', texto: '8 o más caracteres' },
  { id: 'mayuscula', texto: 'Una mayúscula' },
  { id: 'minuscula', texto: 'Una minúscula' },
  { id: 'numero', texto: 'Un número' },
  { id: 'simbolo', texto: 'Un símbolo (!, ?, #, …)' },
  { id: 'noComun', texto: 'No es una contraseña común' },
  { id: 'noNombre', texto: 'No contiene tu nombre' },
];

export interface EvaluacionPassword {
  vacia: boolean;
  nivel: NivelPassword;
  /** 0 a 1, para la barra del medidor. */
  progreso: number;
  criterios: Record<IdCriterio, boolean>;
  mensaje: string;
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', $: 's' };

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n');
}

function normalizar(s: string): string {
  return sinTildes(s.toLowerCase());
}

function desLeet(s: string): string {
  return s.replace(/[0134@$5]/g, (c) => LEET[c] ?? c);
}

const COMUNES = new Set(CONTRASENAS_COMUNES.map(normalizar));

export function esComun(password: string): boolean {
  const base = normalizar(password);
  if (COMUNES.has(base)) return true;
  // "boca123", "river!!", "messi2010": la parte de letras es una común.
  const sinColita = base.replace(/[\d\W_]+$/, '');
  if (sinColita.length >= 3 && COMUNES.has(sinColita)) return true;
  const leet = desLeet(base);
  if (COMUNES.has(leet)) return true;
  const leetSinColita = leet.replace(/[\d\W_]+$/, '');
  return leetSinColita.length >= 3 && COMUNES.has(leetSinColita);
}

export function contieneNombre(password: string, nombre: string): boolean {
  const pass = normalizar(password);
  const passLeet = desLeet(pass);
  const partes = normalizar(nombre)
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 3);
  return partes.some((p) => pass.includes(p) || passLeet.includes(p));
}

export function evaluarPassword(password: string, nombre = ''): EvaluacionPassword {
  const criterios: Record<IdCriterio, boolean> = {
    largo: password.length >= 8,
    mayuscula: /\p{Lu}/u.test(password),
    minuscula: /\p{Ll}/u.test(password),
    numero: /\d/.test(password),
    simbolo: /[^\p{L}\d]/u.test(password),
    noComun: password.length > 0 && !esComun(password),
    noNombre: password.length > 0 && !contieneNombre(password, nombre),
  };

  const composicion = [criterios.mayuscula, criterios.minuscula, criterios.numero, criterios.simbolo].filter(
    Boolean,
  ).length;

  let nivel: NivelPassword;
  if (!criterios.noComun || !criterios.noNombre || !criterios.largo) {
    nivel = 'debil';
  } else if (composicion <= 2) {
    // Una frase larga solo con letras también aguanta bastante.
    nivel = password.length >= 12 ? 'media' : 'debil';
  } else if (composicion === 3) {
    nivel = password.length >= 14 ? 'fuerte' : 'media';
  } else {
    nivel = password.length >= 12 ? 'muy-fuerte' : 'fuerte';
  }

  const cumplidos = Object.values(criterios).filter(Boolean).length;
  const progreso = password.length === 0 ? 0 : Math.max(0.08, (NIVELES.indexOf(nivel) + 1) / 4 - (7 - cumplidos) * 0.02);

  return {
    vacia: password.length === 0,
    nivel,
    progreso: Math.min(1, progreso),
    criterios,
    mensaje: mensajePara(password, nivel, criterios),
  };
}

function mensajePara(password: string, nivel: NivelPassword, c: Record<IdCriterio, boolean>): string {
  if (password.length === 0) return 'Inventá una que solo sepas vos.';
  if (!c.noComun) return '¡Esa la adivina cualquiera!';
  if (!c.noNombre) return 'Tu nombre es lo primero que prueban 👀';
  if (nivel === 'muy-fuerte') return '¡Imposible de hackear! 💪';
  if (nivel === 'fuerte') return c.simbolo ? '¡Muy buena! Si la alargás, mejor todavía.' : '¡Muy buena! Con un símbolo queda blindada.';
  const falta = !c.largo
    ? 'sumale caracteres, que llegue a 8'
    : !c.simbolo
      ? 'sumale un símbolo'
      : !c.numero
        ? 'sumale un número'
        : !c.mayuscula
          ? 'sumale una mayúscula'
          : 'sumale una minúscula';
  if (nivel === 'media') return `Vas bien, ${falta}.`;
  return password.length < 6 ? 'Muy cortita, así se adivina enseguida.' : `Todavía es fácil: ${falta}.`;
}

export function alcanzaNivel(nivel: NivelPassword, minimo: NivelPassword): boolean {
  return NIVELES.indexOf(nivel) >= NIVELES.indexOf(minimo);
}

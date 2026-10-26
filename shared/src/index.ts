export * from './types';
export * from './events';
export * from './password';
export * from './comunes';
export * from './quiz';
export * from './juego';
export * from './resultados';
export * from './clase';

/** Emojis para los avatares de los alumnos (el profe puede cambiarlos). */
export const AVATARES: readonly string[] = [
  '🦊', '🐼', '🐸', '🐙', '🦁', '🐯', '🐨', '🐵', '🦉', '🐧', '🐢', '🦄',
  '🐝', '🦖', '🐬', '🦜', '🐶', '🐱', '🐰', '🐻', '🚀', '⚡', '🎧', '🎮',
  '🛹', '🌵', '🍕', '⚽', '🎸', '🌈', '🔥', '🍩',
];

export function avatarAlAzar(): string {
  return AVATARES[Math.floor(Math.random() * AVATARES.length)]!;
}

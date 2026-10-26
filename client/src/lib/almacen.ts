// localStorage puede fallar (modo privado, almacenamiento bloqueado): nunca romper por eso.

export const CLAVES = {
  tokenAlumno: 'aula:token-alumno',
  tokenProfe: 'aula:token-profe',
  ultimaComision: 'aula:ultima-comision',
  liviano: 'aula:modo-liviano',
  sonido: 'aula:sonido-pantalla',
  sonidoManos: 'aula:sonido-manos',
  tema: 'aula:tema',
} as const;

export function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardar(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: la sesión dura lo que dure la pestaña.
  }
}

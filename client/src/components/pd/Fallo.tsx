import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CLAVE_RECARGA = 'aula:recargado-por-fallo';

/** Si la app se actualizó con la página abierta, los archivos viejos ya no existen: alcanza con recargar. */
function esArchivoViejo(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk/i.test(error.message);
}

/**
 * El DOM no es el que React dejó: algo de afuera lo tocó (el traductor del navegador, una extensión).
 * Volver a armar esa parte de la pantalla lo arregla.
 */
function esDomAjeno(error: Error): boolean {
  return error.name === 'NotFoundError' || /insertBefore|removeChild|not a child of this node/i.test(error.message);
}

interface Props {
  /** Para el aviso en la consola del server: "profe", "alumno", "pantalla"… */
  vista: string;
  /** Si cambia, se vuelve a intentar (por ejemplo, al cambiar de pestaña). */
  clave?: string;
  /** Versión chica, para una sección: el resto de la página sigue andando. */
  seccion?: boolean;
  children: ReactNode;
}

interface Estado {
  error: Error | null;
  clave?: string;
}

/**
 * Si algo de la pantalla falla, en vez de quedar en blanco se muestra un aviso con "Volver a
 * cargar". El error se manda al server, que lo escribe en su consola.
 */
export class Fallo extends Component<Props, Estado> {
  state: Estado = { error: null, clave: this.props.clave };
  /** Cuándo se rearmó solo, para no entrar en un bucle si el problema sigue. */
  private rearmados: number[] = [];

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, estado: Estado): Partial<Estado> | null {
    return props.clave !== estado.clave ? { clave: props.clave, error: null } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    const ahora = Date.now();
    this.rearmados = this.rearmados.filter((t) => ahora - t < 10_000);
    const rearmar = esDomAjeno(error) && this.rearmados.length < 3;
    if (esArchivoViejo(error)) {
      try {
        if (!sessionStorage.getItem(CLAVE_RECARGA)) {
          sessionStorage.setItem(CLAVE_RECARGA, '1');
          location.reload();
          return;
        }
      } catch {
        // Sin sessionStorage, mejor no arriesgar un bucle de recargas.
      }
    }
    void fetch('/api/errores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vista: this.props.vista,
        mensaje: `${error.message}${rearmar ? ' (se rearmó sola)' : ''}`,
        detalle: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
      }),
    }).catch(() => {});
    if (rearmar) {
      this.rearmados.push(ahora);
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        className={
          this.props.seccion
            ? 'flex flex-col items-start gap-3 rounded-3xl bg-card p-6 shadow-[var(--pd-sombra-tarjeta)]'
            : 'grid min-h-dvh place-items-center p-6'
        }
      >
        <div className="flex max-w-md flex-col gap-3">
          <p className="text-xl font-bold">Algo falló en esta pantalla</p>
          <p className="text-muted-foreground">
            No se perdió nada: lo que está pasando en la clase sigue en la compu del profe. Volvé a cargar la página para seguir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => location.reload()}>
              <RotateCw data-icon="inline-start" />
              Volver a cargar
            </Button>
            {this.props.seccion && (
              <Button variant="ghost" onClick={() => this.setState({ error: null })}>
                Intentar de nuevo
              </Button>
            )}
          </div>
          <p className="text-xs break-words text-muted-foreground">Detalle: {error.message}</p>
        </div>
      </div>
    );
  }
}

// Si la página anduvo un rato después de recargar, se permite otra recarga automática más adelante.
setTimeout(() => {
  try {
    sessionStorage.removeItem(CLAVE_RECARGA);
  } catch {
    // nada
  }
}, 30_000);

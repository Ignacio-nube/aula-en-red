import { useEffect, useState, type FormEvent } from 'react';
import { AVATARES, type AlumnoPublico } from '@aula/shared';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { mensajeDe } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Envía un formulario y muestra el error del servidor sin cerrar el diálogo. */
function useEnvio(onCerrar: () => void) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async (accion: () => Promise<void>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      onCerrar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };
  return { enviando, error, setError, enviar };
}

// --- un solo campo de texto: nueva comisión, renombrar, agregar alumno ---------

export interface PedidoTexto {
  titulo: string;
  descripcion?: string;
  etiqueta: string;
  inicial?: string;
  accion: string;
  max?: number;
  onGuardar: (texto: string) => Promise<void>;
}

export function DialogoTexto({ pedido, onCerrar }: { pedido: PedidoTexto | null; onCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const { enviando, error, setError, enviar } = useEnvio(onCerrar);

  useEffect(() => {
    if (pedido) {
      setTexto(pedido.inicial ?? '');
      setError(null);
    }
  }, [pedido, setError]);

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (pedido && texto.trim()) void enviar(() => pedido.onGuardar(texto.trim()));
  };

  return (
    <Dialog open={pedido !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <form onSubmit={alEnviar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{pedido?.titulo}</DialogTitle>
            {pedido?.descripcion && <DialogDescription>{pedido.descripcion}</DialogDescription>}
          </DialogHeader>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="dialogo-texto">{pedido?.etiqueta}</FieldLabel>
            <Input
              id="dialogo-texto"
              autoFocus
              value={texto}
              maxLength={pedido?.max ?? 60}
              aria-invalid={!!error || undefined}
              onChange={(e) => {
                setTexto(e.target.value);
                setError(null);
              }}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!texto.trim() || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              {pedido?.accion}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- editar alumno: nombre y avatar ----------------------------------------------

export function DialogoAlumno({
  alumno,
  onCerrar,
  onGuardar,
}: {
  alumno: AlumnoPublico | null;
  onCerrar: () => void;
  onGuardar: (cambios: { nombre: string; avatar: string }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [avatar, setAvatar] = useState('');
  const { enviando, error, setError, enviar } = useEnvio(onCerrar);

  useEffect(() => {
    if (alumno) {
      setNombre(alumno.nombre);
      setAvatar(alumno.avatar);
      setError(null);
    }
  }, [alumno, setError]);

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) void enviar(() => onGuardar({ nombre: nombre.trim(), avatar }));
  };

  return (
    <Dialog open={alumno !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={alEnviar} className="flex flex-col gap-4">
          <DialogHeader className="flex-row items-center gap-4">
            <PinAvatar avatar={avatar || '🙂'} tamano={52} />
            <div className="flex flex-col gap-1">
              <DialogTitle>Editar alumno</DialogTitle>
              <DialogDescription>El avatar aparece en la pantalla grande y en el ranking.</DialogDescription>
            </div>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="alumno-nombre">Nombre</FieldLabel>
              <Input
                id="alumno-nombre"
                value={nombre}
                maxLength={60}
                aria-invalid={!!error || undefined}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setError(null);
                }}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Avatar</FieldLegend>
              <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-8 gap-1.5">
                {AVATARES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={a === avatar}
                    aria-label={a}
                    onClick={() => setAvatar(a)}
                    className={cn(
                      'grid aspect-square place-items-center rounded-xl text-2xl transition-[background-color,transform] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90',
                      a === avatar && 'bg-pd-celeste-claro ring-2 ring-pd-celeste',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </FieldSet>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!nombre.trim() || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- pegar una lista de nombres ----------------------------------------------------

export function DialogoLote({
  abierto,
  comision,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  comision: string;
  onCerrar: () => void;
  onGuardar: (texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const { enviando, error, setError, enviar } = useEnvio(onCerrar);
  const cantidad = texto.split(/[\n;,]+/).filter((n) => n.trim()).length;

  useEffect(() => {
    if (abierto) {
      setTexto('');
      setError(null);
    }
  }, [abierto, setError]);

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (cantidad > 0) void enviar(() => onGuardar(texto));
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Pegar lista de alumnos</DialogTitle>
            <DialogDescription>Se agregan a {comision}. Cada uno recibe un avatar al azar.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="lote">Nombres, uno por línea</FieldLabel>
            <Textarea
              id="lote"
              autoFocus
              rows={8}
              value={texto}
              placeholder={'Valentina Gómez\nThiago Fernández\nMía Rodríguez'}
              className="max-h-72"
              onChange={(e) => setTexto(e.target.value)}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>También sirve copiar una columna de Excel. Los nombres repetidos se saltean.</FieldDescription>
            )}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={cantidad === 0 || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              {cantidad === 1 ? 'Agregar 1 alumno' : `Agregar ${cantidad} alumnos`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

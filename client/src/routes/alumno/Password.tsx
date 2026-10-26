import { useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { alcanzaNivel, evaluarPassword, type AlumnoPublico, type NivelPassword, type SesionAlumno } from '@aula/shared';
import { CampoPassword } from '@/components/pd/CampoPassword';
import { Logo } from '@/components/pd/Logo';
import { MedidorPassword } from '@/components/pd/MedidorPassword';
import { PinAvatar } from '@/components/pd/Pin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { api, ErrorApi, mensajeDe } from '@/lib/api';

interface Props {
  alumno: AlumnoPublico;
  nivelMinimo: NivelPassword;
  onVolver: () => void;
  onEntrar: (sesion: SesionAlumno) => void;
  /** El servidor dice que el estado cambió (por ejemplo, el profe restauró la contraseña). */
  onCambioEstado: (alumno: AlumnoPublico) => void;
}

export function Password(props: Props) {
  const { alumno, onVolver } = props;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onVolver}>
          <ChevronLeft data-icon="inline-start" />
          No soy {alumno.nombre.split(' ')[0]}
        </Button>
        <Logo alto={50} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        {alumno.tienePassword ? <Ingresar {...props} /> : <Crear {...props} />}
      </div>
    </div>
  );
}

function Saludo({ alumno, titulo, bajada }: { alumno: AlumnoPublico; titulo: string; bajada: string }) {
  return (
    <div className="flex items-center gap-4">
      <PinAvatar avatar={alumno.avatar} tamano={56} />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-muted-foreground">Hola, {alumno.nombre} 👋</p>
        <h1 className="text-3xl font-extrabold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{bajada}</p>
      </div>
    </div>
  );
}

function Crear({ alumno, nivelMinimo, onEntrar, onCambioEstado }: Props) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const evaluacion = useMemo(() => evaluarPassword(password, alumno.nombre), [password, alumno.nombre]);

  const alcanza = alcanzaNivel(evaluacion.nivel, nivelMinimo) && !evaluacion.vacia;
  const coinciden = password === confirmacion;
  // Avisar recién cuando ya no puede llegar a coincidir (no mientras la va escribiendo).
  const mostrarNoCoinciden = confirmacion.length > 0 && !coinciden && (!password.startsWith(confirmacion) || confirmacion.length >= password.length);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!alcanza || !coinciden) return;
    setEnviando(true);
    try {
      onEntrar(await api<SesionAlumno>('/alumno/crear-password', { method: 'POST', body: { alumnoId: alumno.id, password } }));
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) onCambioEstado({ ...alumno, tienePassword: true });
      toast.error(mensajeDe(err));
      setEnviando(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardContent>
        <form onSubmit={enviar} className="grid gap-x-10 gap-y-6 p-2 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <Saludo alumno={alumno} titulo="Creá tu contraseña" bajada="Es solo tuya: ni el profe la puede ver." />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <CampoPassword
                  id="password"
                  autoFocus
                  value={password}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field data-invalid={mostrarNoCoinciden || undefined}>
                <FieldLabel htmlFor="confirmacion">Repetila</FieldLabel>
                <CampoPassword
                  id="confirmacion"
                  value={confirmacion}
                  maxLength={128}
                  aria-invalid={mostrarNoCoinciden || undefined}
                  onChange={(e) => setConfirmacion(e.target.value)}
                />
                {mostrarNoCoinciden ? (
                  <FieldError>No coinciden todavía.</FieldError>
                ) : (
                  <FieldDescription>Escribila de nuevo para asegurarte de que la recordás.</FieldDescription>
                )}
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" disabled={!alcanza || !coinciden || enviando}>
              {enviando ? <Spinner data-icon="inline-start" /> : <LockKeyhole data-icon="inline-start" />}
              Crear contraseña y entrar
            </Button>
          </div>
          <div className="rounded-3xl bg-pd-celeste-claro/60 p-5 lg:self-center">
            <MedidorPassword evaluacion={evaluacion} minimo={nivelMinimo} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Ingresar({ alumno, onEntrar, onCambioEstado }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setEnviando(true);
    setError(null);
    try {
      onEntrar(await api<SesionAlumno>('/alumno/login', { method: 'POST', body: { alumnoId: alumno.id, password } }));
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        onCambioEstado({ ...alumno, tienePassword: false });
        toast.info('El profe restauró tu contraseña. Creá una nueva.');
      } else {
        setError(mensajeDe(err));
      }
      setEnviando(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-6 p-2">
          <Saludo alumno={alumno} titulo="Ingresá tu contraseña" bajada="La que creaste la primera vez." />
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <CampoPassword
              id="password"
              autoFocus
              value={password}
              maxLength={128}
              aria-invalid={!!error || undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>¿Te la olvidaste? Pedile al profe que la restaure.</FieldDescription>
            )}
          </Field>
          <Button type="submit" size="lg" disabled={!password || enviando}>
            {enviando && <Spinner data-icon="inline-start" />}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { NIVELES, NOMBRE_NIVEL, type ConfigPublica, type NivelPassword } from '@aula/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { mensajeDe } from '@/lib/api';
import { useProfe } from './contexto';

export function Ajustes({ abierto, onCambiarAbierto }: { abierto: boolean; onCambiarAbierto: (a: boolean) => void }) {
  const { pedir } = useProfe();
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setError(null);
    pedir<ConfigPublica>('/config')
      .then(setConfig)
      .catch((e) => setError(mensajeDe(e)));
  }, [abierto, pedir]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setEnviando(true);
    try {
      await pedir('/config', { method: 'PATCH', body: config });
      toast.success('Guardaste los ajustes');
      onCambiarAbierto(false);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambiarAbierto}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Ajustes del curso</DialogTitle>
            <DialogDescription>Se aplican al instante en todas las pantallas.</DialogDescription>
          </DialogHeader>
          {config ? (
            <FieldGroup>
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="nombre-curso">Nombre del curso</FieldLabel>
                <Input
                  id="nombre-curso"
                  value={config.nombreCurso}
                  maxLength={80}
                  onChange={(e) => setConfig({ ...config, nombreCurso: e.target.value })}
                />
                <FieldDescription>Se muestra en la pantalla grande y al entrar.</FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Contraseña mínima para los alumnos</FieldLegend>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={config.nivelMinimoPassword}
                  onValueChange={(v) => v && setConfig({ ...config, nivelMinimoPassword: v as NivelPassword })}
                  className="w-full"
                >
                  {NIVELES.map((n) => (
                    <ToggleGroupItem key={n} value={n} className="flex-1">
                      {NOMBRE_NIVEL[n]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>Vale para las contraseñas nuevas. Las que ya existen siguen andando.</FieldDescription>
              </FieldSet>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          ) : error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <Spinner />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!config || enviando}>
              {enviando && <Spinner data-icon="inline-start" />}
              Guardar ajustes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

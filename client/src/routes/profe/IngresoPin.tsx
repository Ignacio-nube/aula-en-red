import { useState, type FormEvent } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { CampoPassword } from '@/components/pd/CampoPassword';
import { Logo } from '@/components/pd/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { api, mensajeDe } from '@/lib/api';

export function IngresoPin({ onEntrar }: { onEntrar: (token: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sacudir = useAnimationControls();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setEnviando(true);
    try {
      const { token } = await api<{ token: string }>('/profe/login', { method: 'POST', body: { pin } });
      onEntrar(token);
    } catch (err) {
      setError(mensajeDe(err));
      setPin('');
      void sacudir.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo alto={84} />
      <motion.div animate={sacudir} className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Panel del profe</CardTitle>
            <CardDescription>Ingresá el PIN para administrar las clases.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={enviar} className="flex flex-col gap-4">
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="pin">PIN</FieldLabel>
                <CampoPassword
                  id="pin"
                  autoFocus
                  inputMode="numeric"
                  value={pin}
                  aria-invalid={!!error || undefined}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError(null);
                  }}
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
              <Button type="submit" size="lg" disabled={!pin || enviando}>
                {enviando && <Spinner data-icon="inline-start" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}

import { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, ClipboardCopy, Import } from 'lucide-react';
import { toast } from 'sonner';
import { importarPreguntas, instruccionesParaIA, LIMITES, NOMBRE_TIPO, problemasPregunta, type PreguntaImportada } from '@aula/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Cuántas preguntas tiene ya el quiz (para no pasarse del máximo). */
  yaHay: number;
  onImportar: (preguntas: PreguntaImportada[], titulo: string | null) => void;
}

/** Pegar preguntas en texto (por ejemplo, armadas con Claude) y agregarlas al quiz. */
export function ImportarPreguntas({ abierto, onCerrar, yaHay, onImportar }: Props) {
  const [texto, setTexto] = useState('');
  // Correctas marcadas a mano en la vista previa: pregunta → índices de opciones. Se borran si cambia el texto.
  const [marcas, setMarcas] = useState<Map<number, number[]>>(new Map());
  const resultado = useMemo(() => importarPreguntas(texto), [texto]);
  const lugar = Math.max(0, LIMITES.preguntas - yaHay);
  const preguntas = useMemo(
    () =>
      resultado.preguntas.slice(0, lugar).map((p, i) => {
        const m = marcas.get(i);
        if (!m) return p;
        const q = { ...p, opciones: p.opciones.map((o, k) => ({ ...o, esCorrecta: m.includes(k) })) };
        return { ...q, problemas: problemasPregunta(q) };
      }),
    [resultado, lugar, marcas],
  );

  const cambiarTexto = (t: string) => {
    setTexto(t);
    setMarcas(new Map());
  };

  /** Tocar una opción la marca como correcta (en "varias correctas" se prende y apaga). */
  const marcar = (i: number, k: number) => {
    const p = preguntas[i];
    if (!p || p.tipo === 'ordenar' || p.tipo === 'tipeo') return;
    const actuales = p.opciones.flatMap((o, j) => (o.esCorrecta ? [j] : []));
    const nuevas = p.tipo === 'varias' ? (actuales.includes(k) ? actuales.filter((j) => j !== k) : [...actuales, k]) : [k];
    setMarcas((m) => new Map(m).set(i, nuevas));
  };
  const conProblemas = preguntas.filter((p) => p.problemas.length > 0).length;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(instruccionesParaIA());
      toast.success('Copiaste las instrucciones. Pegalas en Claude y cambiá el tema.');
    } catch {
      // Sin permiso de portapapeles (por ejemplo, entrando por IP sin https): se muestran para copiar a mano.
      cambiarTexto(instruccionesParaIA());
      toast.info('No se pudo copiar solo: te dejé las instrucciones en el cuadro para que las copies.');
    }
  };

  const importar = () => {
    onImportar(preguntas, resultado.titulo);
    cambiarTexto('');
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar preguntas</DialogTitle>
          <DialogDescription>
            Pegá las preguntas en texto. Si las armás con Claude, copiá las instrucciones, pegáselas con el tema y traé lo que te devuelva con su botón de
            copiar.
          </DialogDescription>
        </DialogHeader>

        <Button variant="secondary" className="self-start" onClick={() => void copiar()}>
          <ClipboardCopy data-icon="inline-start" />
          Copiar instrucciones para la IA
        </Button>

        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="importar-texto">Preguntas</FieldLabel>
            <Textarea
              id="importar-texto"
              value={texto}
              onChange={(e) => cambiarTexto(e.target.value)}
              spellCheck={false}
              className="h-72 resize-none font-mono text-sm"
              placeholder={'? ¿Qué atajo copia?\n* Ctrl + C\n- Ctrl + V\n- Ctrl + X\n\n? Ordená los pasos…\n1. Primero\n2. Después\n3. Al final'}
            />
            <FieldDescription>
              "?" empieza una pregunta, "*" marca la correcta, "-" las incorrectas y "1." los pasos. Si se perdieron las marcas, tocá la correcta en la vista
              previa.
            </FieldDescription>
          </Field>

          <div className="flex min-h-0 flex-col gap-2">
            <p className="text-sm font-medium">
              {preguntas.length === 0 ? 'Vista previa' : preguntas.length === 1 ? '1 pregunta' : `${preguntas.length} preguntas`}
              {preguntas.length > 0 && <span className="font-normal text-muted-foreground"> (tocá una opción para marcarla como correcta)</span>}
            </p>
            <ol className="flex h-72 flex-col gap-2 overflow-y-auto rounded-2xl bg-muted p-2">
              {preguntas.length === 0 && (
                <li className="m-auto px-6 text-center text-sm text-muted-foreground">Acá vas a ver lo que se entiende de lo que pegues.</li>
              )}
              {preguntas.map((p, i) => (
                <li
                  key={`${p.linea}-${i}`}
                  className={cn('flex flex-col gap-1 rounded-xl bg-card p-3 text-sm', p.problemas.length > 0 && 'ring-2 ring-destructive/40')}
                >
                  <div className="flex items-start gap-2">
                    {p.problemas.length > 0 ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-bien-texto" />
                    )}
                    <span className="min-w-0 flex-1 font-semibold">{p.texto || '(sin texto)'}</span>
                    <Badge variant="outline">{NOMBRE_TIPO[p.tipo]}</Badge>
                  </div>
                  {p.tipo === 'tipeo' ? (
                    <p className="pl-6 text-muted-foreground">Los alumnos tipean ese texto, en carrera.</p>
                  ) : (
                    <ul className="flex flex-col gap-0.5 pl-4 text-muted-foreground">
                      {p.opciones.map((o, k) =>
                        p.tipo === 'ordenar' ? (
                          <li key={k} className="px-2">
                            {k + 1}. {o.texto}
                          </li>
                        ) : (
                          <li key={k}>
                            <button
                              type="button"
                              onClick={() => marcar(i, k)}
                              aria-pressed={o.esCorrecta}
                              title={o.esCorrecta ? 'Es la correcta' : 'Marcar como correcta'}
                              className={cn(
                                'w-full rounded-lg px-2 py-0.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
                                o.esCorrecta && 'font-semibold text-bien-texto',
                              )}
                            >
                              {o.esCorrecta ? '✓ ' : '· '}
                              {o.texto}
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                  {p.problemas.map((x) => (
                    <p key={x} className="pl-6 text-destructive">
                      {x}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {(resultado.avisos.length > 0 || resultado.preguntas.length > lugar) && (
          <ul className="flex max-h-24 flex-col gap-0.5 overflow-y-auto text-sm text-muted-foreground">
            {resultado.preguntas.length > lugar && (
              <li>
                El quiz llega a {LIMITES.preguntas} preguntas: se agregan solo las primeras {lugar}.
              </li>
            )}
            {resultado.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={importar} disabled={preguntas.length === 0}>
            <Import data-icon="inline-start" />
            {preguntas.length === 0 ? 'Agregar' : preguntas.length === 1 ? 'Agregar 1 pregunta' : `Agregar ${preguntas.length} preguntas`}
          </Button>
        </DialogFooter>
        {conProblemas > 0 && (
          <p className="-mt-2 text-right text-sm text-muted-foreground">
            {conProblemas === 1 ? 'Una queda' : `${conProblemas} quedan`} para completar en el editor.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

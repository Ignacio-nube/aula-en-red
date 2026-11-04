import { useState, type ComponentProps, type CSSProperties } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

// Los navegadores ofrecen guardar (o sugerir) contraseñas cuando el campo es type="password". En las
// compus del aula eso es un problema: el siguiente que se sienta entra con la cuenta de otro. Con
// `sinGuardar`, el campo es de texto y los puntitos los pone el CSS, así el navegador no lo reconoce.
// Si el navegador no sabe poner puntitos por CSS, queda como contraseña común.
const PUNTITOS_POR_CSS = typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');

type Props = Omit<ComponentProps<typeof InputGroupInput>, 'type'> & {
  /** Que el navegador nunca ofrezca guardarla (las de los alumnos). */
  sinGuardar?: boolean;
};

/** Campo de contraseña con "ojito" para mostrarla u ocultarla. */
export function CampoPassword({ sinGuardar = false, style, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const porCss = sinGuardar && PUNTITOS_POR_CSS;
  return (
    <InputGroup>
      <InputGroupInput
        type={visible || porCss ? 'text' : 'password'}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        // Para que tampoco lo tomen los gestores de contraseñas (1Password, LastPass, Bitwarden).
        {...(sinGuardar ? { 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': true, 'data-form-type': 'other' } : {})}
        style={porCss ? ({ ...style, WebkitTextSecurity: visible ? 'none' : 'disc' } as CSSProperties) : style}
        // Como el campo es de texto, copiar funcionaría: oculta, no se deja copiar (igual que una contraseña).
        onCopy={porCss && !visible ? (e) => e.preventDefault() : undefined}
        onCut={porCss && !visible ? (e) => e.preventDefault() : undefined}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

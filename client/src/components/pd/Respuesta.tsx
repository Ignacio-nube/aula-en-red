import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { LETRAS, type TipoPregunta } from '@aula/shared';
import { cn } from '@/lib/utils';

// Cada respuesta tiene color Y forma, para que se distingan sin depender del color.
export type Forma = 'circulo' | 'triangulo' | 'rombo' | 'cuadrado' | 'verdadero' | 'falso';

export interface EstiloRespuesta {
  forma: Forma;
  fondo: string;
  /** Texto sobre el fondo: blanco, salvo en el amarillo y el verde (gris oscuro, por contraste). */
  texto: string;
  nombre: string;
}

const MULTIPLE: EstiloRespuesta[] = [
  { forma: 'circulo', fondo: 'var(--pd-resp-a)', texto: '#fff', nombre: 'círculo' },
  { forma: 'triangulo', fondo: 'var(--pd-resp-b)', texto: '#fff', nombre: 'triángulo' },
  { forma: 'rombo', fondo: 'var(--pd-resp-c)', texto: 'var(--pd-gris-texto)', nombre: 'rombo' },
  { forma: 'cuadrado', fondo: 'var(--pd-resp-d)', texto: 'var(--pd-gris-texto)', nombre: 'cuadrado' },
];
const VF: EstiloRespuesta[] = [
  { forma: 'verdadero', fondo: 'var(--pd-resp-d)', texto: 'var(--pd-gris-texto)', nombre: 'verdadero' },
  { forma: 'falso', fondo: 'var(--pd-resp-b)', texto: '#fff', nombre: 'falso' },
];

export function estiloRespuesta(tipo: TipoPregunta, indice: number): EstiloRespuesta {
  return (tipo === 'vf' ? VF : MULTIPLE)[indice] ?? MULTIPLE[0]!;
}

/** Nombre corto para mensajes: "la B", "Verdadero". */
export function nombreRespuesta(tipo: TipoPregunta, indice: number, texto: string): string {
  return tipo === 'vf' ? texto : `la ${LETRAS[indice]}`;
}

export function FormaRespuesta({ forma, className, color = 'currentColor' }: { forma: Forma; className?: string; color?: string }) {
  if (forma === 'verdadero') return <Check className={className} strokeWidth={3.5} color={color} aria-hidden />;
  if (forma === 'falso') return <X className={className} strokeWidth={3.5} color={color} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {forma === 'circulo' && <circle cx="12" cy="12" r="9.5" fill={color} />}
      {forma === 'triangulo' && <path d="M12 2.8 22 20.5H2Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="1.5" />}
      {forma === 'rombo' && <path d="M12 1.8 22.2 12 12 22.2 1.8 12Z" fill={color} />}
      {forma === 'cuadrado' && <rect x="3" y="3" width="18" height="18" rx="2.5" fill={color} />}
    </svg>
  );
}

interface BotonProps {
  tipo: TipoPregunta;
  indice: number;
  texto: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Atenuado (no es la elegida, o no es la correcta en el resultado). */
  apagado?: boolean;
  /** Para las que se marcan y desmarcan (varias correctas). */
  presionado?: boolean;
  marca?: ReactNode;
  className?: string;
  tamano?: 'md' | 'lg' | 'xl';
}

/** Botón grande de respuesta, con su color y su forma. */
export function BotonRespuesta({ tipo, indice, texto, onClick, disabled, apagado, presionado, marca, className, tamano = 'lg' }: BotonProps) {
  const e = estiloRespuesta(tipo, indice);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      aria-pressed={presionado}
      animate={{ opacity: apagado ? (presionado === undefined ? 0.28 : 0.6) : 1, scale: apagado ? 0.98 : presionado ? 1.02 : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      aria-label={`${tipo === 'vf' ? '' : `Opción ${LETRAS[indice]}, ${e.nombre}: `}${texto}`}
      className={cn(
        'relative flex min-h-0 items-center gap-4 rounded-3xl text-left font-bold shadow-[0_6px_0_rgb(0_0_0/0.14)] outline-none focus-visible:ring-4 focus-visible:ring-pd-celeste/60 disabled:cursor-default',
        !disabled && 'cursor-pointer hover:brightness-105 active:shadow-[0_2px_0_rgb(0_0_0/0.14)]',
        tamano === 'md' && 'px-4 py-3 text-base',
        tamano === 'lg' && 'px-4 py-3 text-[clamp(1.15rem,2vw,1.6rem)] sm:px-6 sm:py-5 bajo:py-2',
        tamano === 'xl' && 'px-[2vw] py-[2.4vh] text-[clamp(1.2rem,2.3vw,2.8rem)]',
        className,
      )}
      // Sombra suave en el texto blanco: el verde y el coral son claros para texto chico.
      style={{ backgroundColor: e.fondo, color: e.texto, textShadow: e.texto === '#fff' ? '0 1px 2px rgb(0 0 0 / 0.28)' : undefined }}
    >
      <FormaRespuesta
        forma={e.forma}
        color={e.texto}
        className={cn('shrink-0', tamano === 'md' ? 'size-6' : tamano === 'lg' ? 'size-7 sm:size-9' : 'size-[clamp(2rem,3.2vw,3.6rem)]')}
      />
      <span className="min-w-0 flex-1 leading-tight break-words">{texto}</span>
      {marca}
    </motion.button>
  );
}

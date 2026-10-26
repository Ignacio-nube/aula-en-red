import { cn } from '@/lib/utils';

/**
 * Logo oficial de Punto Digital: siempre el archivo original, nunca redibujado.
 * El padding le da el espacio libre que pide la marca alrededor.
 */
export function Logo({ alto = 72, className }: { alto?: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0', className)} style={{ padding: Math.round(alto * 0.12) }}>
      <img
        src="/brand/logo-punto-digital.png"
        alt="Punto Digital"
        width={Math.round(alto * 0.98)}
        height={alto}
        draggable={false}
        className="block select-none"
        style={{ height: alto, width: 'auto' }}
      />
    </span>
  );
}

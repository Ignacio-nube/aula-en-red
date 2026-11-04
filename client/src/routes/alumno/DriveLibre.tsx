import type { AlumnoPublico } from '@aula/shared';
import { Drive } from '@/components/drive/Drive';
import { useMiDrive } from '@/lib/drive';
import type { SocketAula } from '@/lib/socket';

/** El Drive del alumno, para practicar cuando quiera (fuera de las misiones). */
export function DriveLibre({ token, socket, alumno, onCerrar }: { token: string; socket: SocketAula | null; alumno: AlumnoPublico; onCerrar: () => void }) {
  const { drive, setDrive } = useMiDrive(token, socket);
  return (
    <div className="flex min-h-0 flex-1 flex-col sm:px-3 sm:pb-3">
      <Drive
        drive={drive}
        setDrive={setDrive}
        token={token}
        dueno={alumno}
        onCerrar={onCerrar}
        className="overflow-hidden shadow-[var(--pd-sombra-tarjeta)] sm:rounded-3xl"
      />
    </div>
  );
}

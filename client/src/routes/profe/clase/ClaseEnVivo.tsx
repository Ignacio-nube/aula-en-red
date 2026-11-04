import { definicionDe } from '@/actividades/registro';
import { useProfe } from '../contexto';
import { ControlJuego } from './ControlJuego';
import { ControlPresentacion } from './ControlPresentacion';
import { ControlEncuesta, HerramientasClase } from './HerramientasClase';
import { PreparacionClase } from './PreparacionClase';

/**
 * Lo que esté pasando (un quiz, una actividad o una presentación) con sus controles; si no hay nada, elegir qué
 * empezar. Arriba, la encuesta en curso; abajo, las herramientas que se usan en cualquier momento.
 */
export function ClaseEnVivo() {
  const { juego, presentacion, encuesta, actividad } = useProfe();
  const Actividad = actividad.estado ? definicionDe(actividad.estado).Control : null;
  return (
    <div className="flex flex-col gap-6">
      {encuesta && <ControlEncuesta encuesta={encuesta} />}
      {juego.estado ? (
        <ControlJuego estado={juego.estado} recibido={juego.recibido} />
      ) : Actividad && actividad.estado ? (
        <Actividad estado={actividad.estado} recibido={actividad.recibido} />
      ) : presentacion ? (
        <ControlPresentacion estado={presentacion} />
      ) : (
        <PreparacionClase />
      )}
      <HerramientasClase />
    </div>
  );
}

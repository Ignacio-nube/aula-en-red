import { useProfe } from '../contexto';
import { ControlJuego } from './ControlJuego';
import { ControlPresentacion } from './ControlPresentacion';
import { ControlEncuesta, HerramientasClase } from './HerramientasClase';
import { PreparacionClase } from './PreparacionClase';

/**
 * Lo que esté pasando (un quiz o una presentación) con sus controles; si no hay nada, elegir qué
 * empezar. Arriba, la encuesta en curso; abajo, las herramientas que se usan en cualquier momento.
 */
export function ClaseEnVivo() {
  const { juego, presentacion, encuesta } = useProfe();
  return (
    <div className="flex flex-col gap-6">
      {encuesta && <ControlEncuesta encuesta={encuesta} />}
      {juego.estado ? (
        <ControlJuego estado={juego.estado} recibido={juego.recibido} />
      ) : presentacion ? (
        <ControlPresentacion estado={presentacion} />
      ) : (
        <PreparacionClase />
      )}
      <HerramientasClase />
    </div>
  );
}

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { Fallo } from '@/components/pd/Fallo';
import { PinLoader } from '@/components/pd/Pin';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLiviano } from '@/lib/liviano';
import '@/lib/tema';
import './index.css';

// Cada vista en su propio archivo: las PCs de los alumnos no bajan el código del profe.
const AlumnoApp = lazy(() => import('@/routes/alumno/AlumnoApp').then((m) => ({ default: m.AlumnoApp })));
const ProfeApp = lazy(() => import('@/routes/profe/ProfeApp').then((m) => ({ default: m.ProfeApp })));
const PantallaApp = lazy(() =>
  import('@/routes/pantalla/PantallaApp').then((m) => ({
    default: m.PantallaApp,
  })),
);

function Raiz() {
  const liviano = useLiviano();
  return (
    // "user" respeta prefers-reduced-motion del sistema operativo; el modo liviano las reduce siempre.
    <MotionConfig reducedMotion={liviano ? 'always' : 'user'}>
      <TooltipProvider>
        <BrowserRouter>
          <Fallo vista={location.pathname.startsWith('/profe') ? 'profe' : location.pathname.startsWith('/pantalla') ? 'pantalla' : 'alumno'}>
            <Suspense
              fallback={
                <main className="grid min-h-dvh place-items-center">
                  <PinLoader />
                </main>
              }
            >
              <Routes>
                <Route path="/profe/*" element={<ProfeApp />} />
                <Route path="/pantalla" element={<PantallaApp />} />
                <Route path="*" element={<AlumnoApp />} />
              </Routes>
            </Suspense>
          </Fallo>
        </BrowserRouter>
        {/* En el celu, más arriba: abajo están la barra de pestañas del profe y la mano del alumno. */}
        <Toaster position="bottom-center" richColors={false} mobileOffset={{ bottom: 92 }} />
      </TooltipProvider>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
);

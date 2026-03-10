import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, MoreVertical, Plus, Download, CheckCircle, Smartphone, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/dispatch-up-logo.png';

type Platform = 'android' | 'ios';

const iosSteps = [
  {
    step: 1,
    title: 'Abre en Safari',
    description: 'Asegúrate de estar usando el navegador Safari. Si estás en otro navegador, copia la URL y ábrela en Safari.',
    icon: <Smartphone className="w-8 h-8" />,
  },
  {
    step: 2,
    title: 'Toca Compartir',
    description: 'Toca el botón de Compartir en la parte inferior de la pantalla (el cuadrado con una flecha hacia arriba).',
    icon: <Share className="w-8 h-8" />,
  },
  {
    step: 3,
    title: 'Agregar a Inicio',
    description: 'Desplázate en el menú y toca "Agregar a pantalla de inicio".',
    icon: <Plus className="w-8 h-8" />,
  },
  {
    step: 4,
    title: 'Toca Agregar',
    description: 'Toca "Agregar" en la esquina superior derecha para confirmar la instalación.',
    icon: <CheckCircle className="w-8 h-8" />,
  },
];

const androidSteps = [
  {
    step: 1,
    title: 'Abre en Chrome',
    description: 'Asegúrate de estar usando Google Chrome en tu dispositivo Android.',
    icon: <Smartphone className="w-8 h-8" />,
  },
  {
    step: 2,
    title: 'Toca el Menú',
    description: 'Toca el botón de tres puntos ⋮ en la esquina superior derecha de Chrome.',
    icon: <MoreVertical className="w-8 h-8" />,
  },
  {
    step: 3,
    title: 'Instalar App',
    description: 'Toca "Instalar aplicación" o "Agregar a pantalla de inicio" en el menú.',
    icon: <Download className="w-8 h-8" />,
  },
  {
    step: 4,
    title: 'Confirmar',
    description: 'Toca "Instalar" en el diálogo que aparece para completar la instalación.',
    icon: <CheckCircle className="w-8 h-8" />,
  },
];

// Visual components
function IOSStep1Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-secondary rounded-2xl p-3 shadow-lg border border-border">
        <div className="bg-card rounded-xl p-2 mb-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
          <div className="flex-1 h-5 bg-muted rounded-md flex items-center px-2">
            <span className="text-[9px] text-muted-foreground truncate">dispatch-up.com/install</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-16 bg-primary/20 rounded-lg flex items-center justify-center">
            <img src={logoImg} className="h-10 w-auto rounded-lg" alt="Dispatch Up" />
          </div>
          <div className="h-2 bg-muted rounded w-3/4" />
          <div className="h-2 bg-muted rounded w-1/2" />
        </div>
        <div className="mt-2 flex justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <div className="w-3 h-0.5 bg-muted-foreground" />
            </div>
            <div className="w-8 h-1 rounded bg-muted-foreground/50" />
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <Share className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="bg-primary/20 rounded-full p-1.5">
          <span className="text-xs text-primary font-semibold">Safari ✓</span>
        </motion.div>
      </div>
    </div>
  );
}

function IOSStep2Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-secondary rounded-2xl p-3 shadow-lg border border-border relative">
        <div className="space-y-1 mb-3">
          <div className="h-2 bg-muted rounded w-full" />
          <div className="h-2 bg-muted rounded w-4/5" />
          <div className="h-2 bg-muted rounded w-3/5" />
        </div>
        <div className="border-t border-border pt-2 flex justify-around items-center">
          <div className="w-5 h-5 rounded bg-muted" />
          <div className="w-5 h-5 rounded bg-muted" />
          <motion.div
            animate={{ scale: [1, 1.3, 1], y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-7 h-7 rounded-lg bg-primary/80 flex items-center justify-center shadow-md"
          >
            <Share className="w-4 h-4 text-primary-foreground" />
          </motion.div>
          <div className="w-5 h-5 rounded bg-muted" />
          <div className="w-5 h-5 rounded bg-muted" />
        </div>
      </div>
      <motion.div
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ repeat: Infinity, duration: 3, times: [0, 0.3, 0.7, 1] }}
        className="mt-2 text-center"
      >
        <span className="text-xs text-primary font-medium">← Toca Compartir aquí</span>
      </motion.div>
    </div>
  );
}

function IOSStep3Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-muted/50 p-2 border-b border-border">
          <p className="text-[9px] text-center text-muted-foreground font-medium">Menú Compartir</p>
        </div>
        {[
          { icon: '🔗', label: 'Copiar enlace' },
          { icon: '📧', label: 'Correo' },
          { icon: '💬', label: 'Mensajes' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
            <span className="text-base">{item.icon}</span>
            <span className="text-[10px] text-foreground">{item.label}</span>
          </div>
        ))}
        <motion.div
          animate={{ backgroundColor: ['rgba(59,130,246,0)', 'rgba(59,130,246,0.15)', 'rgba(59,130,246,0)'] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-primary/10"
        >
          <span className="text-base">➕</span>
          <span className="text-[10px] font-semibold text-primary">Agregar a pantalla de inicio</span>
        </motion.div>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-base">🔖</span>
          <span className="text-[10px] text-foreground">Agregar marcador</span>
        </div>
      </div>
    </div>
  );
}

function AndroidStep1Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-secondary rounded-2xl p-3 shadow-lg border border-border">
        <div className="bg-card rounded-xl flex items-center gap-2 px-2 py-1.5 mb-2">
          <div className="w-3 h-3 rounded-full bg-success/60" />
          <div className="flex-1 h-5 bg-muted rounded-md flex items-center px-2">
            <span className="text-[9px] text-muted-foreground">dispatch-up.com/install</span>
          </div>
          <MoreVertical className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <div className="h-16 bg-primary/20 rounded-lg flex items-center justify-center">
            <img src={logoImg} className="h-10 w-auto rounded-lg" alt="Dispatch Up" />
          </div>
          <div className="h-2 bg-muted rounded w-3/4" />
          <div className="h-2 bg-muted rounded w-1/2" />
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="bg-primary/20 rounded-full p-1.5">
          <span className="text-xs text-primary font-semibold">Chrome ✓</span>
        </motion.div>
      </div>
    </div>
  );
}

function AndroidStep2Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto relative">
      <div className="bg-secondary rounded-2xl p-3 shadow-lg border border-border">
        <div className="bg-card rounded-xl flex items-center gap-2 px-2 py-1.5 mb-2">
          <div className="flex-1 h-5 bg-muted rounded-md" />
          <motion.div
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-6 h-6 rounded bg-primary/80 flex items-center justify-center"
          >
            <MoreVertical className="w-3 h-3 text-primary-foreground" />
          </motion.div>
        </div>
        <div className="h-20 bg-muted/50 rounded-lg" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-10, 0, 0, -10] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute top-8 right-2 bg-card border border-border rounded-lg shadow-xl p-2 w-36 z-10"
      >
        <div className="space-y-1">
          {['Nueva pestaña', 'Historial', 'Descargas', 'Instalar app'].map((item, i) => (
            <div key={item} className={`text-[9px] px-2 py-1 rounded ${i === 3 ? 'bg-primary/20 text-primary font-bold' : 'text-foreground'}`}>
              {item}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function AndroidStep3Visual() {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-secondary rounded-2xl p-3 shadow-lg border border-border">
        <div className="h-16 bg-muted/50 rounded-lg mb-2" />
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="bg-card border border-border rounded-xl p-3 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <img src={logoImg} className="h-8 w-8 rounded-lg object-contain" alt="Dispatch Up" />
            <div>
              <p className="text-[9px] font-bold text-foreground">Dispatch Up</p>
              <p className="text-[8px] text-muted-foreground">dispatch-up.com</p>
            </div>
          </div>
          <p className="text-[8px] text-muted-foreground mb-2">Instala esta app en tu pantalla de inicio para acceso rápido.</p>
          <div className="flex gap-1">
            <div className="flex-1 h-5 bg-muted rounded text-center flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">Cancelar</span>
            </div>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex-1 h-5 bg-primary rounded flex items-center justify-center"
            >
              <span className="text-[8px] text-primary-foreground font-bold">Instalar</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ConfirmVisual({ platform }: { platform: Platform }) {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="bg-secondary rounded-2xl p-4 shadow-lg border border-border flex flex-col items-center gap-3">
        <motion.div
          animate={{ scale: [0.8, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center"
        >
          <img src={logoImg} className="h-10 w-10 rounded-xl object-contain" alt="Dispatch Up" />
        </motion.div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-foreground">Dispatch Up</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Instalada en tu pantalla</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-8 h-8 bg-success rounded-full flex items-center justify-center shadow-md"
        >
          <CheckCircle className="w-5 h-5 text-success-foreground" />
        </motion.div>
        <p className="text-[9px] text-success font-semibold">
          {platform === 'ios' ? 'Toca "Agregar" para confirmar' : 'Toca "Instalar" para confirmar'}
        </p>
      </div>
    </div>
  );
}

const iosVisuals = [<IOSStep1Visual />, <IOSStep2Visual />, <IOSStep3Visual />, <ConfirmVisual platform="ios" />];
const androidVisuals = [<AndroidStep1Visual />, <AndroidStep2Visual />, <AndroidStep3Visual />, <ConfirmVisual platform="android" />];

export default function Install() {
  const detectedIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const defaultPlatform: Platform = detectedIOS ? 'ios' : 'android';

  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = platform === 'ios' ? iosSteps : androidSteps;
  const visuals = platform === 'ios' ? iosVisuals : androidVisuals;
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => { if (!isLast) setCurrentStep((s) => s + 1); };
  const handlePrev = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };
  const switchPlatform = (p: Platform) => { setPlatform(p); setCurrentStep(0); };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/10 to-background flex flex-col">

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-4 mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 flex gap-3 items-start shadow-sm"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center mt-0.5">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">¿Se ve la app pequeña?</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Desde el navegador la barra de URL roba espacio.{' '}
            <span className="font-semibold text-foreground">Instálala siguiendo los pasos de abajo</span> y se verá en pantalla completa.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">
              <span>🌐</span> <span>Navegador = pequeño</span>
            </div>
            <span className="text-muted-foreground text-xs">→</span>
            <div className="flex items-center gap-1.5 text-[11px] text-foreground font-semibold bg-success/15 border border-success/30 rounded-full px-2.5 py-1">
              <span>📱</span> <span>Instalada = pantalla completa</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <div className="flex flex-col items-center pt-6 pb-4 px-4">
        <motion.img
          src={logoImg}
          alt="Dispatch Up"
          className="h-16 w-auto mb-3"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.h1
          className="text-2xl font-bold text-foreground text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Instalar Dispatch Up
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground text-center mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Sigue los pasos para instalar la app en tu teléfono
        </motion.p>
      </div>

      {/* Platform Selector */}
      <div className="flex justify-center px-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-1 flex gap-1 shadow-sm">
          <button
            onClick={() => switchPlatform('android')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              platform === 'android'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🤖</span> Android
          </button>
          <button
            onClick={() => switchPlatform('ios')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              platform === 'ios'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🍎</span> iPhone / iPad
          </button>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex justify-center gap-2 mb-6 px-4">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={`transition-all duration-300 rounded-full ${
              i === currentStep ? 'w-8 h-2.5 bg-primary' : i < currentStep ? 'w-2.5 h-2.5 bg-primary/50' : 'w-2.5 h-2.5 bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step Card */}
      <div className="flex-1 px-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${platform}-${currentStep}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-sm mx-auto"
          >
            <div className="bg-primary/5 border-b border-border px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Paso {step.step} de {steps.length}</p>
                <h2 className="text-base font-bold text-foreground">{step.title}</h2>
              </div>
            </div>
            <div className="px-5 pt-5 pb-3 flex justify-center min-h-[180px] items-center">
              {visuals[currentStep]}
            </div>
            <div className="px-5 pb-5">
              <p className="text-sm text-muted-foreground text-center leading-relaxed">{step.description}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-5 max-w-sm mx-auto">
          <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0} className="flex-1">
            <ChevronLeft className="w-4 h-4" />
            Atrás
          </Button>
          {isLast ? (
            <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="flex-1">
              <Button className="w-full bg-success hover:bg-success/90 text-success-foreground">
                <CheckCircle className="w-4 h-4" />
                ¡Listo! Abrir la App
              </Button>
            </motion.div>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 max-w-sm mx-auto">
          Después de instalar, abre Dispatch Up desde tu pantalla de inicio e inicia sesión con tus credenciales.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Camera, MessageSquare, Hand, BarChart2, X, BookOpen, ArrowRight } from 'lucide-react';
import { USTag } from '../shared/USTag';

const steps = [
  {
    id: 1,
    title: 'Controles de cámara y micrófono',
    description: 'Gestiona tu cámara y micrófono desde la barra de herramientas inferior. Puedes activarlos o desactivarlos en cualquier momento durante la sesión.',
    icon: Camera,
    zone: 'toolbar',
    us: ['US32'],
  },
  {
    id: 2,
    title: 'Panel de atención en tiempo real',
    description: 'El panel derecho (pestaña "Mi Atención") muestra tu índice de atención personal. El análisis se realiza localmente en tu navegador y no se almacena.',
    icon: BarChart2,
    zone: 'right',
    us: ['US21', 'US32'],
  },
  {
    id: 3,
    title: 'Chat y levantamiento de mano',
    description: 'Usa la pestaña "Chat" para comunicarte con el grupo. Presiona el botón "Levantar mano" en la barra inferior para pedir turno al docente.',
    icon: Hand,
    zone: 'chat',
    us: ['US13', 'US14', 'US32'],
  },
  {
    id: 4,
    title: 'Panel del docente — analítica de atención',
    description: 'Como docente, el panel derecho muestra la atención grupal e individual. Puedes exportar el reporte completo al final de la sesión.',
    icon: BarChart2,
    zone: 'analytics',
    us: ['US24', 'US25', 'US32'],
  },
];

function MockSessionBg() {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#2A2A2A' }}>
      {/* Toolbar at top */}
      <div style={{ height: 36, backgroundColor: '#1A1A1A', borderBottom: '1px solid #333' }} />

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div style={{ width: 220, backgroundColor: '#1F1F1F', borderRight: '1px solid #333' }}>
          <div style={{ padding: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  backgroundColor: '#2A2A2A',
                  borderRadius: 3,
                  marginBottom: 4,
                  border: '1px solid #333',
                }}
              />
            ))}
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 p-4">
          {/* Main video */}
          <div
            style={{
              height: 260,
              backgroundColor: '#3A3A3A',
              borderRadius: 6,
              border: '1px solid #444',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={40} color="#555" />
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ width: 280, backgroundColor: '#1F1F1F', borderLeft: '1px solid #333' }}>
          <div style={{ height: 36, borderBottom: '1px solid #333', display: 'flex' }}>
            <div style={{ flex: 1, backgroundColor: '#2A2A2A', borderBottom: '2px solid #555' }} />
            <div style={{ flex: 1 }} />
          </div>
          <div style={{ padding: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 28,
                  backgroundColor: '#2A2A2A',
                  borderRadius: 3,
                  marginBottom: 6,
                  border: '1px solid #333',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div
        style={{
          height: 70,
          backgroundColor: '#1A1A1A',
          borderTop: '2px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '0 24px',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#2A2A2A',
              borderRadius: 6,
              border: '1px solid #333',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HighlightBubble({ zone }: { zone: string }) {
  const positions: Record<string, React.CSSProperties> = {
    toolbar: {
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 320,
      height: 64,
      border: '3px solid #FFFFFF',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    right: {
      position: 'absolute',
      top: 48,
      right: 8,
      width: 292,
      bottom: 80,
      border: '3px solid #FFFFFF',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    chat: {
      position: 'absolute',
      top: 48,
      right: 8,
      width: 292,
      height: 200,
      border: '3px solid #FFFFFF',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    analytics: {
      position: 'absolute',
      top: 48,
      right: 8,
      width: 292,
      bottom: 80,
      border: '3px solid #FFFFFF',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
  };

  return <div style={positions[zone] || {}} />;
}

export function S7_Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="relative" style={{ height: 'calc(100vh - 44px)', overflow: 'hidden' }}>
      {/* Background session */}
      <MockSessionBg />

      {/* Highlight zone */}
      <HighlightBubble zone={step.zone} />

      {/* Dim overlay (excluding highlight) */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }}
      />

      {/* Tutorial card */}
      <div
        className="absolute flex flex-col"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          border: '2px solid #424242',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ backgroundColor: '#424242' }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#9E9E9E',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StepIcon size={16} color="#FFFFFF" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>
                  Paso {currentStep + 1} de {steps.length}
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#FFFFFF', margin: 0, fontWeight: 600 }}>
                {step.title}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentStep(steps.length)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} color="#9E9E9E" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex gap-1 px-5 pt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= currentStep ? '#424242' : '#E0E0E0',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          <div
            style={{
              padding: '3px 8px',
              backgroundColor: '#F5F5F5',
              borderRadius: 3,
              border: '1px solid #E0E0E0',
              display: 'inline-block',
            }}
          >
            <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP08 — Onboarding · {step.us.join(', ')}</span>
          </div>

          <p style={{ fontSize: '13px', color: '#424242', margin: 0, lineHeight: 1.6 }}>
            {step.description}
          </p>

          {/* Step-specific callout */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#F5F5F5',
              border: '1px dashed #9E9E9E',
              borderRadius: 6,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <MessageSquare size={13} color="#9E9E9E" style={{ marginTop: 2 }} />
            <div>
              <p style={{ fontSize: '11px', color: '#9E9E9E', margin: 0 }}>
                {currentStep === 0 && 'El área resaltada en la parte inferior es la barra de herramientas principal.'}
                {currentStep === 1 && 'El panel de atención está resaltado en el lado derecho de la pantalla.'}
                {currentStep === 2 && 'Usa el chat y el botón de mano para interactuar con el docente.'}
                {currentStep === 3 && 'Como docente, accede a la analítica completa desde el panel derecho.'}
              </p>
            </div>
          </div>
          <USTag ids={step.us} />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: '1px solid #E0E0E0' }}
        >
          <div className="flex items-center gap-4">
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: '#9E9E9E',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => setCurrentStep(steps.length)}
            >
              Saltar tutorial
            </button>
            <USTag ids={['US34']} />
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #9E9E9E',
                  borderRadius: 6,
                  backgroundColor: '#F5F5F5',
                  fontSize: '13px',
                  color: '#424242',
                  cursor: 'pointer',
                }}
              >
                Anterior
              </button>
            )}
            <button
              onClick={() => currentStep < steps.length - 1 ? setCurrentStep(currentStep + 1) : setCurrentStep(0)}
              style={{
                padding: '8px 18px',
                border: '1px solid #424242',
                borderRadius: 6,
                backgroundColor: '#424242',
                fontSize: '13px',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {currentStep < steps.length - 1 ? 'Siguiente' : 'Reiniciar'}
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Manual link */}
        <div
          className="px-5 py-2 flex justify-center"
          style={{ borderTop: '1px solid #E0E0E0', backgroundColor: '#FAFAFA' }}
        >
          <div className="flex items-center gap-1.5">
            <BookOpen size={11} color="#9E9E9E" />
            <a href="#" style={{ fontSize: '11px', color: '#9E9E9E', textDecoration: 'underline' }}>
              Acceder al manual completo
            </a>
            <USTag ids={['US34']} className="ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

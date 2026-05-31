import { AlertTriangle, X, Camera, SlidersHorizontal, CheckCircle, AlertOctagon } from 'lucide-react';
import { USTag } from '../shared/USTag';
import { useState } from 'react';

function BackgroundSession() {
  return (
    <div
      className="absolute inset-0 flex"
      style={{ backgroundColor: '#2A2A2A', filter: 'blur(2px)' }}
    >
      <div style={{ width: 220, backgroundColor: '#1A1A1A', borderRight: '1px solid #333' }} />
      <div className="flex-1 p-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 90,
                backgroundColor: '#3A3A3A',
                borderRadius: 4,
                border: '1px solid #444',
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ width: 280, backgroundColor: '#1A1A1A', borderLeft: '1px solid #333' }} />
    </div>
  );
}

export function S5_ProctoringAlert() {
  const [sensitivity, setSensitivity] = useState(65);

  return (
    <div className="relative" style={{ height: 'calc(100vh - 44px)', overflow: 'hidden' }}>
      {/* Blurred background */}
      <BackgroundSession />

      {/* Overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        {/* Modal */}
        <div
          style={{
            width: 520,
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            border: '2px solid #424242',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Modal header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ backgroundColor: '#424242' }}
          >
            <div className="flex items-center gap-2">
              <AlertOctagon size={18} color="#FFFFFF" />
              <h3 style={{ color: '#FFFFFF', margin: 0 }}>Detección múltiple de rostros</h3>
            </div>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={18} color="#FFFFFF" />
            </button>
          </div>

          {/* Modal body */}
          <div className="p-5 flex flex-col gap-5">
            {/* Epic label */}
            <div
              style={{
                padding: '3px 8px',
                backgroundColor: '#F5F5F5',
                borderRadius: 3,
                border: '1px solid #E0E0E0',
                display: 'inline-block',
              }}
            >
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP07 — Proctoring · US29, US30, US31</span>
            </div>

            {/* Student info + thumbnail */}
            <div className="flex gap-4 items-start">
              {/* Video thumbnail */}
              <div
                style={{
                  width: 140,
                  height: 105,
                  backgroundColor: '#E0E0E0',
                  borderRadius: 6,
                  border: '1px solid #9E9E9E',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <Camera size={28} color="#9E9E9E" />
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>María Torres</span>
                {/* Face detection boxes */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 22,
                    width: 34,
                    height: 34,
                    border: '2px dashed #424242',
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 22,
                    width: 28,
                    height: 28,
                    border: '2px dashed #9E9E9E',
                    borderRadius: 2,
                  }}
                />
              </div>

              {/* Alert details */}
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <p style={{ fontSize: '14px', color: '#000000', fontWeight: 600, margin: 0 }}>
                    María Torres
                  </p>
                  <p style={{ fontSize: '12px', color: '#9E9E9E', margin: '2px 0 0 0' }}>
                    Estudiante · Sesión activa
                  </p>
                </div>

                <div
                  className="flex items-start gap-2 px-3 py-3 rounded"
                  style={{ backgroundColor: '#F5F5F5', border: '1px solid #E0E0E0' }}
                >
                  <AlertTriangle size={15} color="#424242" style={{ marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: '13px', color: '#424242', margin: 0, fontWeight: 500 }}>
                      Se detectaron 2 rostros en la cámara de María Torres
                    </p>
                    <p style={{ fontSize: '11px', color: '#9E9E9E', margin: '4px 0 0 0' }}>
                      Detectado a las 10:42:15 — Confianza: 87%
                    </p>
                  </div>
                </div>
                <USTag ids={['US29', 'US31']} />
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#E0E0E0' }} />

            {/* Sensitivity slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} color="#424242" />
                  <span style={{ fontSize: '13px', color: '#424242', fontWeight: 500 }}>
                    Umbral de sensibilidad de proctoring
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: '#424242', fontWeight: 600 }}>
                  {sensitivity}%
                </span>
              </div>
              <div style={{ position: 'relative', height: 8 }}>
                <div style={{ height: '100%', backgroundColor: '#E0E0E0', borderRadius: 4 }} />
                <div
                  style={{
                    width: `${sensitivity}%`,
                    height: '100%',
                    backgroundColor: '#424242',
                    borderRadius: 4,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Permisivo</span>
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Estricto</span>
              </div>
              <USTag ids={['US30']} />
            </div>

            <div style={{ height: 1, backgroundColor: '#E0E0E0' }} />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                className="flex-1 flex items-center justify-center gap-2"
                style={{
                  padding: '11px 16px',
                  border: '1px solid #9E9E9E',
                  borderRadius: 6,
                  backgroundColor: '#F5F5F5',
                  fontSize: '13px',
                  color: '#424242',
                  cursor: 'pointer',
                }}
              >
                <CheckCircle size={15} />
                Marcar como legítimo
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2"
                style={{
                  padding: '11px 16px',
                  border: '1px solid #424242',
                  borderRadius: 6,
                  backgroundColor: '#424242',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                <AlertTriangle size={15} />
                Enviar advertencia al estudiante
              </button>
            </div>
            <USTag ids={['US29', 'US31']} />
          </div>
        </div>
      </div>
    </div>
  );
}

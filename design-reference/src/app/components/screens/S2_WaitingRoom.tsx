import { Camera, Mic, MicOff, VideoOff, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { USTag } from '../shared/USTag';
import { ConnectionIndicator } from '../shared/ConnectionIndicator';
import { useState } from 'react';

export function S2_WaitingRoom() {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-start py-8 px-4">
      {/* Page title */}
      <div className="w-full mb-6" style={{ maxWidth: 720 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000', margin: 0 }}>Sala de Espera</h2>
            <p style={{ fontSize: '12px', color: '#9E9E9E', margin: '4px 0 0 0' }}>
              Verifica tus dispositivos antes de entrar · Clase: <strong>Matemáticas — Grupo A</strong>
            </p>
          </div>
          <div
            style={{
              padding: '4px 10px',
              backgroundColor: '#F5F5F5',
              borderRadius: 3,
              border: '1px solid #E0E0E0',
            }}
          >
            <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP03 — Pre-sesión</span>
          </div>
        </div>
      </div>

      {/* Lighting warning banner */}
      <div
        className="w-full flex items-center gap-3 px-4 py-3 mb-4"
        style={{
          maxWidth: 720,
          backgroundColor: '#E0E0E0',
          border: '1px solid #9E9E9E',
          borderRadius: 6,
        }}
      >
        <AlertTriangle size={16} color="#424242" />
        <div className="flex-1">
          <span style={{ fontSize: '12px', color: '#424242', fontWeight: 600 }}>
            Condiciones de iluminación insuficientes para análisis de atención
          </span>
          <p style={{ fontSize: '11px', color: '#9E9E9E', margin: '2px 0 0 0' }}>
            Mejora la iluminación de tu entorno para que el sistema pueda analizar tu atención correctamente.
          </p>
        </div>
        <USTag ids={['US22']} />
      </div>

      {/* Main card */}
      <div
        className="w-full"
        style={{
          maxWidth: 720,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E0E0E0',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div className="flex gap-0">
          {/* Camera preview */}
          <div className="flex-1 flex flex-col">
            {/* Video placeholder */}
            <div
              style={{
                backgroundColor: '#E0E0E0',
                height: 340,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                position: 'relative',
              }}
            >
              {camOn ? (
                <>
                  <Camera size={48} color="#9E9E9E" />
                  <span style={{ fontSize: '13px', color: '#9E9E9E' }}>Vista previa de cámara</span>
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      padding: '2px 8px',
                      backgroundColor: '#424242',
                      borderRadius: 3,
                    }}
                  >
                    <span style={{ fontSize: '9px', color: '#FFFFFF', fontStyle: 'italic' }}>Twilio Video</span>
                  </div>
                </>
              ) : (
                <>
                  <VideoOff size={48} color="#9E9E9E" />
                  <span style={{ fontSize: '13px', color: '#9E9E9E' }}>Cámara desactivada</span>
                </>
              )}
              <USTag ids={['US07', 'US33']} className="absolute bottom-2 left-2" />
            </div>

            {/* Device controls */}
            <div
              className="flex items-center justify-center gap-6 px-6 py-4"
              style={{ borderTop: '1px solid #E0E0E0' }}
            >
              {/* Mic toggle */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setMicOn(!micOn)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    border: `2px solid ${micOn ? '#424242' : '#9E9E9E'}`,
                    backgroundColor: micOn ? '#424242' : '#F5F5F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {micOn ? <Mic size={20} color="#FFFFFF" /> : <MicOff size={20} color="#9E9E9E" />}
                </button>
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>{micOn ? 'Micrófono activo' : 'Micrófono apagado'}</span>
                <USTag ids={['US07']} />
              </div>

              {/* Camera toggle */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setCamOn(!camOn)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    border: `2px solid ${camOn ? '#424242' : '#9E9E9E'}`,
                    backgroundColor: camOn ? '#424242' : '#F5F5F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {camOn ? <Camera size={20} color="#FFFFFF" /> : <VideoOff size={20} color="#9E9E9E" />}
                </button>
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>{camOn ? 'Cámara activa' : 'Cámara apagada'}</span>
                <USTag ids={['US07']} />
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div
            className="flex flex-col gap-4 p-5"
            style={{
              width: 260,
              borderLeft: '1px solid #E0E0E0',
              backgroundColor: '#FAFAFA',
            }}
          >
            <h4 style={{ color: '#000000', margin: 0 }}>Verificación previa</h4>

            {/* Connection quality */}
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>Calidad de conexión</span>
              <ConnectionIndicator quality="medium" showLabel showUS />
            </div>

            {/* Device checks */}
            <div className="flex flex-col gap-2">
              <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>Estado de dispositivos</span>
              {[
                { label: 'Micrófono detectado', ok: true },
                { label: 'Cámara detectada', ok: true },
                { label: 'Altavoces funcionando', ok: true },
                { label: 'Iluminación adecuada', ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  {item.ok ? (
                    <CheckCircle size={13} color="#424242" />
                  ) : (
                    <AlertTriangle size={13} color="#9E9E9E" />
                  )}
                  <span style={{ fontSize: '11px', color: item.ok ? '#424242' : '#9E9E9E' }}>
                    {item.label}
                  </span>
                </div>
              ))}
              <USTag ids={['US22']} />
            </div>

            {/* Privacy notice */}
            <div
              style={{
                padding: '10px',
                backgroundColor: '#F5F5F5',
                border: '1px dashed #E0E0E0',
                borderRadius: 4,
              }}
            >
              <div className="flex items-start gap-1.5">
                <Shield size={12} color="#9E9E9E" style={{ marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#424242', margin: 0, fontWeight: 500 }}>
                    Privacidad de datos faciales
                  </p>
                  <p style={{ fontSize: '10px', color: '#9E9E9E', margin: '3px 0' }}>
                    El análisis de atención se procesa localmente. No se almacenan datos faciales.
                  </p>
                  <a href="#" style={{ fontSize: '10px', color: '#424242', textDecoration: 'underline' }}>
                    Política de privacidad →
                  </a>
                  <USTag ids={['US37']} />
                </div>
              </div>
            </div>

            {/* Enter button */}
            <div className="mt-auto flex flex-col gap-1">
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#424242',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Entrar a la sala
              </button>
              <USTag ids={['US07', 'US33', 'US37']} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

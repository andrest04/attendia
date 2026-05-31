import { Monitor, Lock, Shield, User, BookOpen, SlidersHorizontal } from 'lucide-react';
import { USTag } from '../shared/USTag';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div style={{ width: 3, height: 20, backgroundColor: '#424242', borderRadius: 2 }} />
      <h2 style={{ color: '#000000', margin: 0 }}>{children}</h2>
    </div>
  );
}

function InputField({ label, placeholder, type = 'text', usIds }: { label: string; placeholder: string; type?: string; usIds?: string[] }) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <label style={{ fontSize: '13px', color: '#424242' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        readOnly
        style={{
          border: '1px solid #9E9E9E',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: '13px',
          color: '#9E9E9E',
          backgroundColor: '#FFFFFF',
          outline: 'none',
          width: '100%',
        }}
      />
      {usIds && <USTag ids={usIds} />}
    </div>
  );
}

export function S1_Access() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      {/* Header */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E0E0E0',
          padding: '20px 40px',
        }}
      >
        <div className="flex items-end gap-3">
          <div>
            <h1 style={{ color: '#000000', margin: 0, fontSize: '22px', fontWeight: 700 }}>
              Plataforma de Prueba
            </h1>
            <p style={{ fontSize: '12px', color: '#9E9E9E', margin: '4px 0 0 0' }}>
              Plataforma de Videoconferencia Síncrona para Aulas Híbridas con Detección de Atención
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Token badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{ border: '1px solid #9E9E9E', borderRadius: 4, backgroundColor: '#F5F5F5' }}
            >
              <Lock size={12} color="#424242" />
              <span style={{ fontSize: '11px', color: '#424242' }}>Acceso seguro por token</span>
              <USTag ids={['US36']} className="ml-1" />
            </div>
            {/* No-install badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{ border: '1px solid #E0E0E0', borderRadius: 4, backgroundColor: '#F5F5F5' }}
            >
              <Monitor size={12} color="#9E9E9E" />
              <span style={{ fontSize: '11px', color: '#9E9E9E' }}>Usar desde navegador, sin instalación</span>
              <USTag ids={['US33']} className="ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex gap-8 w-full" style={{ maxWidth: 900 }}>
          
          {/* LEFT: Profesor - Crear sala */}
          <div
            className="flex-1"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
              borderRadius: 8,
              padding: '28px 32px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: '#424242',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen size={18} color="#FFFFFF" />
              </div>
              <div>
                <h3 style={{ color: '#000000', margin: 0 }}>Profesor</h3>
                <span style={{ fontSize: '11px', color: '#9E9E9E' }}>Crear nueva sala de clase</span>
              </div>
            </div>

            <div
              style={{
                padding: '4px 10px',
                backgroundColor: '#F5F5F5',
                borderRadius: 3,
                border: '1px solid #E0E0E0',
                marginBottom: 20,
                display: 'inline-block',
              }}
            >
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP01 — Gestión de Sala</span>
            </div>

            <InputField
              label="Nombre de la sala"
              placeholder="Ej: Matemáticas — Grupo A"
              usIds={['US01']}
            />

            {/* Toggle recording */}
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center justify-between">
                <label style={{ fontSize: '13px', color: '#424242' }}>Habilitar grabación</label>
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      backgroundColor: '#424242',
                      borderRadius: 11,
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: 3,
                        right: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#9E9E9E' }}>Activo</span>
                </div>
              </div>
              <USTag ids={['US12']} />
            </div>

            {/* Proctoring sensitivity slider */}
            <div className="flex flex-col gap-1 mb-6">
              <div className="flex items-center justify-between">
                <label style={{ fontSize: '13px', color: '#424242' }}>Sensibilidad de proctoring</label>
                <SlidersHorizontal size={14} color="#9E9E9E" />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Baja</span>
                <div style={{ flex: 1, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, position: 'relative' }}>
                  <div style={{ width: '60%', height: '100%', backgroundColor: '#424242', borderRadius: 3 }} />
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      backgroundColor: '#424242',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '50%',
                      left: '60%',
                      transform: 'translate(-50%, -50%)',
                      border: '2px solid #FFFFFF',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Alta</span>
              </div>
              <USTag ids={['US30']} />
            </div>

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
              Crear sala
            </button>
            <USTag ids={['US01', 'US02']} className="mt-2" />
          </div>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div style={{ width: 1, height: 80, backgroundColor: '#E0E0E0' }} />
            <span
              style={{
                fontSize: '11px',
                color: '#9E9E9E',
                padding: '6px 10px',
                border: '1px solid #E0E0E0',
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
              }}
            >
              o
            </span>
            <div style={{ width: 1, height: 80, backgroundColor: '#E0E0E0' }} />
          </div>

          {/* RIGHT: Estudiante - Unirse */}
          <div
            className="flex-1"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
              borderRadius: 8,
              padding: '28px 32px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: '#9E9E9E',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={18} color="#FFFFFF" />
              </div>
              <div>
                <h3 style={{ color: '#000000', margin: 0 }}>Estudiante</h3>
                <span style={{ fontSize: '11px', color: '#9E9E9E' }}>Unirme a sala existente</span>
              </div>
            </div>

            <div
              style={{
                padding: '4px 10px',
                backgroundColor: '#F5F5F5',
                borderRadius: 3,
                border: '1px solid #E0E0E0',
                marginBottom: 20,
                display: 'inline-block',
              }}
            >
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP01 — Acceso de Estudiante</span>
            </div>

            <InputField
              label="Código o enlace de sala"
              placeholder="Ingresar código de sesión"
              usIds={['US02']}
            />

            <InputField
              label="Tu nombre o alias (no requiere cuenta)"
              placeholder="Ej: Ana García"
              usIds={['US03']}
            />

            {/* Spacer to match height */}
            <div style={{ height: 92 }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#F5F5F5',
                  border: '1px dashed #E0E0E0',
                  borderRadius: 6,
                }}
              >
                <div className="flex items-start gap-2">
                  <Shield size={14} color="#9E9E9E" style={{ marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: '12px', color: '#424242', margin: 0, fontWeight: 500 }}>
                      Aviso de privacidad
                    </p>
                    <p style={{ fontSize: '11px', color: '#9E9E9E', margin: '4px 0 0 0' }}>
                      Al unirte aceptas el procesamiento local de imagen para análisis de atención.
                      No se almacenan datos faciales.
                    </p>
                    <USTag ids={['US37']} className="mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <button
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#9E9E9E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 16,
              }}
            >
              Unirme a la sala
            </button>
            <USTag ids={['US02', 'US03']} className="mt-2" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #E0E0E0',
          backgroundColor: '#FFFFFF',
          padding: '12px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '11px', color: '#9E9E9E' }}>
          Infraestructura: <strong>Twilio Video WebRTC SFU</strong>
        </span>
        <div className="flex gap-4">
          <a href="#" style={{ fontSize: '11px', color: '#9E9E9E', textDecoration: 'underline' }}>
            Política de privacidad de datos faciales
          </a>
          <a href="#" style={{ fontSize: '11px', color: '#9E9E9E', textDecoration: 'underline' }}>
            Seguridad y cifrado
          </a>
        </div>
      </div>
    </div>
  );
}

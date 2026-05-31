import { Lock, Key, Eye, Server, Shield, CheckCircle, ExternalLink, LucideIcon } from 'lucide-react';
import { USTag } from '../shared/USTag';

interface SecuritySectionProps {
  icon: LucideIcon;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  bullets?: string[];
  us: string[];
  epic?: string;
}

function SecuritySection({ icon: Icon, badge, title, subtitle, description, bullets, us, epic }: SecuritySectionProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: 8,
        padding: '24px 28px',
        borderLeft: '4px solid #424242',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            backgroundColor: '#F5F5F5',
            border: '1px solid #E0E0E0',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={22} color="#424242" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Protocol/tech badge */}
            <div
              style={{
                padding: '3px 10px',
                backgroundColor: '#424242',
                borderRadius: 3,
              }}
            >
              <span style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 600, letterSpacing: '0.05em' }}>
                {badge}
              </span>
            </div>
            <h3 style={{ color: '#000000', margin: 0 }}>{title}</h3>
          </div>

          <p style={{ fontSize: '12px', color: '#9E9E9E', margin: '0 0 8px 0', fontStyle: 'italic' }}>
            {subtitle}
          </p>

          <p style={{ fontSize: '13px', color: '#424242', margin: '0 0 10px 0', lineHeight: 1.6 }}>
            {description}
          </p>

          {bullets && (
            <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
              {bullets.map((b) => (
                <li key={b} style={{ fontSize: '12px', color: '#9E9E9E', marginBottom: 4, listStyleType: 'disc' }}>
                  {b}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={13} color="#424242" />
              <span style={{ fontSize: '11px', color: '#424242', fontWeight: 500 }}>Implementado</span>
            </div>
            <div className="flex items-center gap-2">
              {epic && (
                <span
                  style={{
                    fontSize: '9px',
                    color: '#9E9E9E',
                    border: '1px solid #E0E0E0',
                    padding: '1px 6px',
                    borderRadius: 2,
                  }}
                >
                  {epic}
                </span>
              )}
              <USTag ids={us} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function S8_Security() {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 32px' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={22} color="#424242" />
              <h2 style={{ color: '#000000', margin: 0 }}>Seguridad y Privacidad</h2>
            </div>
            <p style={{ fontSize: '12px', color: '#9E9E9E', margin: 0 }}>
              Información sobre los mecanismos de seguridad y privacidad implementados en PDVSPAHCDDA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              style={{
                padding: '4px 10px',
                backgroundColor: '#F5F5F5',
                borderRadius: 3,
                border: '1px solid #E0E0E0',
              }}
            >
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP08 — Seguridad · US35–US38</span>
            </div>
            <button
              className="flex items-center gap-1.5"
              style={{
                padding: '6px 12px',
                border: '1px solid #9E9E9E',
                borderRadius: 5,
                backgroundColor: '#FFFFFF',
                fontSize: '11px',
                color: '#9E9E9E',
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={11} />
              Exportar como PDF
            </button>
          </div>
        </div>

        {/* Security sections */}
        <div className="flex flex-col gap-4">

          {/* SRTP/DTLS */}
          <SecuritySection
            icon={Lock}
            badge="SRTP / DTLS"
            title="Cifrado de transmisión"
            subtitle="Protocolo de seguridad de capa de transporte para medios"
            description="Todas las transmisiones de audio, vídeo y datos se cifran mediante SRTP (Secure Real-time Transport Protocol) y DTLS (Datagram Transport Layer Security), garantizando la confidencialidad e integridad de los medios en tránsito a través de la infraestructura Twilio Video."
            bullets={[
              'SRTP para cifrado de flujos de audio y vídeo',
              'DTLS para negociación de claves y señalización',
              'TLS 1.3 para mensajes de control y API REST',
              'Ningún dato viaja en texto plano',
            ]}
            us={['US35']}
            epic="EP08"
          />

          {/* Access tokens */}
          <SecuritySection
            icon={Key}
            badge="JWT TOKEN"
            title="Tokens de acceso de sesión"
            subtitle="Autenticación sin cuenta de usuario requerida"
            description="El acceso a cada sala de clase se gestiona mediante tokens JWT de corta duración generados por el servidor. Cada token es único por sesión y participante, expirando automáticamente al finalizar la clase o tras un período de inactividad configurable."
            bullets={[
              'Expiración configurable (por defecto: duración de la sesión)',
              'No requiere creación de cuenta de usuario (US03)',
              'Tokens firmados con clave privada del servidor',
              'Revocación inmediata al terminar la sesión',
            ]}
            us={['US36']}
            epic="EP08"
          />

          {/* Facial data */}
          <SecuritySection
            icon={Eye}
            badge="LOCAL ONLY"
            title="Datos faciales — Procesamiento local"
            subtitle="Análisis de atención sin persistencia de datos biométricos"
            description="El análisis de atención basado en visión por computadora (orientación de cabeza, análisis de postura, detección facial) se ejecuta exclusivamente en el navegador del usuario mediante TensorFlow.js. Ningún dato facial, imagen o modelo derivado se transmite o almacena en servidores externos."
            bullets={[
              'Procesamiento 100% local en el navegador (TensorFlow.js)',
              'No se almacenan imágenes faciales ni embeddings',
              'Solo el índice de atención agregado (0–100) se comparte con el docente',
              'El usuario puede desactivar el análisis en cualquier momento',
            ]}
            us={['US37']}
            epic="EP08"
          />

          {/* Availability */}
          <SecuritySection
            icon={Server}
            badge="SLA 99.9%"
            title="Disponibilidad del servicio"
            subtitle="Compromiso de uptime y continuidad de sesiones"
            description="La plataforma se compromete a una disponibilidad del 99.9% (SLA) para sesiones activas, apoyada en la infraestructura global de Twilio Video. En caso de degradación, el sistema reduce automáticamente la calidad de vídeo para mantener la conectividad de todos los participantes."
            bullets={[
              'SLA 99.9% de uptime mensual',
              'Fallback automático a menor resolución ante congestión (US10)',
              'Monitorización en tiempo real del estado de la infraestructura',
              'Soporte para sesiones de hasta 30 participantes simultáneos (US08)',
            ]}
            us={['US38']}
            epic="EP08"
          />
        </div>

        {/* Footer note */}
        <div
          className="flex items-center gap-3 mt-6 p-4"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px dashed #9E9E9E',
            borderRadius: 6,
          }}
        >
          <Shield size={15} color="#9E9E9E" />
          <p style={{ fontSize: '11px', color: '#9E9E9E', margin: 0 }}>
            Este panel es accesible desde cualquier pantalla de la plataforma a través del pie de página o del menú de configuración.
            Para preguntas sobre privacidad, contacte al responsable del tratamiento de datos.
          </p>
        </div>
      </div>
    </div>
  );
}
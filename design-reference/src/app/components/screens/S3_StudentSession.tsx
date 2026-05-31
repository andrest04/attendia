import { useState } from 'react';
import {
  Mic, MicOff, Camera, VideoOff, Monitor, Hand, MessageSquare, LogOut,
  Eye, AlertTriangle, ArrowUp, User, Bell
} from 'lucide-react';
import { VideoTile } from '../shared/VideoTile';
import { AttentionGauge } from '../shared/AttentionGauge';
import { ToolbarButton } from '../shared/ToolbarButton';
import { USTag } from '../shared/USTag';

const participants = [
  { id: 1, name: 'Prof. Martínez', role: 'profesor', handRaised: false },
  { id: 2, name: 'Ana García', role: 'estudiante', handRaised: false },
  { id: 3, name: 'Carlos López', role: 'estudiante', handRaised: true },
  { id: 4, name: 'María Torres', role: 'estudiante', handRaised: false },
  { id: 5, name: 'Luis Pérez', role: 'estudiante', handRaised: false },
  { id: 6, name: 'Sofia Ruiz', role: 'estudiante', handRaised: true },
];

const chatMessages = [
  { id: 1, sender: 'Prof. Martínez', text: 'Bienvenidos a la clase de hoy.', time: '10:02' },
  { id: 2, sender: 'Carlos López', text: 'Tengo una pregunta sobre el ejercicio 3.', time: '10:05' },
  { id: 3, sender: 'Ana García', text: '¿Podría repetir la explicación de la diapositiva 5?', time: '10:08' },
  { id: 4, sender: 'Prof. Martínez', text: 'Claro, lo vemos en un momento.', time: '10:09' },
];

const toasts = [
  { id: 1, text: 'Sofia Ruiz levantó la mano', icon: Hand, us: 'US16' },
  { id: 2, text: 'Luis Pérez se unió a la sala', icon: Bell, us: 'US16' },
];

export function S3_StudentSession() {
  const [activeTab, setActiveTab] = useState<'chat' | 'atencion'>('chat');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 44px)', backgroundColor: '#F5F5F5' }}>
      {/* Degradation notice banner */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ backgroundColor: '#E0E0E0', borderBottom: '1px solid #9E9E9E' }}
      >
        <AlertTriangle size={14} color="#424242" />
        <span style={{ fontSize: '12px', color: '#424242' }}>
          Resolución reducida por baja conectividad
        </span>
        <USTag ids={['US10']} className="ml-1" />
        <button
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: '#9E9E9E',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ✕ Cerrar
        </button>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Participants */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 220,
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E0E0E0',
            overflowY: 'auto',
          }}
        >
          <div className="px-3 py-3 border-b border-[#E0E0E0] flex items-center justify-between">
            <h4 style={{ color: '#000000', margin: 0, fontSize: '13px' }}>Participantes</h4>
            <span
              style={{
                fontSize: '10px',
                color: '#FFFFFF',
                backgroundColor: '#424242',
                padding: '1px 6px',
                borderRadius: 10,
              }}
            >
              {participants.length}
            </span>
          </div>
          <USTag ids={['US04']} className="px-3 pt-1" />

          {/* Participant list */}
          <div className="flex-1 overflow-y-auto">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2.5"
                style={{ borderBottom: '1px solid #F5F5F5' }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: p.role === 'profesor' ? '#424242' : '#E0E0E0',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={14} color={p.role === 'profesor' ? '#FFFFFF' : '#9E9E9E'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '12px', color: '#424242', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </p>
                  {p.role === 'profesor' && (
                    <span style={{ fontSize: '9px', color: '#9E9E9E' }}>Docente</span>
                  )}
                </div>
                {p.handRaised && (
                  <Hand size={12} color="#424242" />
                )}
              </div>
            ))}
            <USTag ids={['US14']} className="px-3 pt-1" />
          </div>

          {/* Toast notifications */}
          <div
            className="px-3 py-3"
            style={{ borderTop: '1px solid #E0E0E0', backgroundColor: '#FAFAFA' }}
          >
            <span style={{ fontSize: '11px', color: '#9E9E9E', fontWeight: 500 }}>Notificaciones</span>
            <div className="flex flex-col gap-2 mt-2">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 px-2 py-2"
                  style={{
                    backgroundColor: '#F5F5F5',
                    border: '1px solid #E0E0E0',
                    borderRadius: 4,
                  }}
                >
                  <t.icon size={11} color="#424242" />
                  <span style={{ fontSize: '10px', color: '#424242' }}>{t.text}</span>
                </div>
              ))}
            </div>
            <USTag ids={['US16']} className="mt-1" />
          </div>
        </div>

        {/* CENTER: Main video */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main video tile */}
          <div
            className="flex-1 relative p-4"
            style={{ backgroundColor: '#2A2A2A' }}
          >
            {/* Active speaker video placeholder */}
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{
                backgroundColor: '#3A3A3A',
                borderRadius: 8,
                position: 'relative',
              }}
            >
              <Camera size={56} color="#666" />
              <span style={{ fontSize: '14px', color: '#9E9E9E' }}>Prof. Martínez (Orador activo)</span>

              {/* Twilio badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  padding: '2px 8px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 3,
                  border: '1px solid #555',
                }}
              >
                <span style={{ fontSize: '9px', color: '#AAAAAA', fontStyle: 'italic' }}>
                  Twilio Video · WebRTC SFU
                </span>
              </div>
              <USTag ids={['US02', 'US06']} className="absolute bottom-2 right-2" />

              {/* Connection quality overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}
              >
                <div className="flex items-end gap-0.5">
                  {[4, 7, 10].map((h, i) => (
                    <div key={i} style={{ width: 3, height: h, backgroundColor: '#AAAAAA', borderRadius: 1 }} />
                  ))}
                </div>
                <span style={{ fontSize: '9px', color: '#AAAAAA' }}>Buena</span>
                <USTag ids={['US11']} className="ml-1" />
              </div>
            </div>

            {/* Self preview (PiP) */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                right: 24,
                width: 140,
                height: 90,
                backgroundColor: '#E0E0E0',
                borderRadius: 6,
                border: '2px solid #9E9E9E',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Camera size={20} color="#9E9E9E" />
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Yo (Ana García)</span>
            </div>
          </div>

          {/* Bottom toolbar */}
          <div
            className="flex items-center justify-center gap-4 px-6 py-3 flex-shrink-0"
            style={{ backgroundColor: '#FFFFFF', borderTop: '2px solid #E0E0E0' }}
          >
            <ToolbarButton icon={micOn ? Mic : MicOff} label={micOn ? 'Silenciar' : 'Activar mic'} active={micOn} onClick={() => setMicOn(!micOn)} usId="US07" />
            <ToolbarButton icon={camOn ? Camera : VideoOff} label={camOn ? 'Apagar cam.' : 'Activar cam.'} active={camOn} onClick={() => setCamOn(!camOn)} usId="US07" />
            <ToolbarButton icon={Monitor} label="Compartir pantalla" disabled usId="US09" />
            <ToolbarButton icon={Hand} label={handRaised ? 'Bajar mano' : 'Levantar mano'} variant={handRaised ? 'active' : 'default'} onClick={() => setHandRaised(!handRaised)} usId="US14" />
            <ToolbarButton icon={MessageSquare} label="Chat" active usId="US13" />
            <div style={{ width: 1, height: 32, backgroundColor: '#E0E0E0', margin: '0 8px' }} />
            <ToolbarButton icon={LogOut} label="Salir" variant="danger" usId="US04" />
          </div>
        </div>

        {/* RIGHT SIDEBAR: Chat / Mi Atención */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 280,
            backgroundColor: '#FFFFFF',
            borderLeft: '1px solid #E0E0E0',
          }}
        >
          {/* Tabs */}
          <div className="flex border-b border-[#E0E0E0]">
            {(['chat', 'atencion'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? '#000000' : '#9E9E9E',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #424242' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                }}
              >
                {tab === 'chat' ? 'Chat' : 'Mi Atención'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'chat' ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span style={{ fontSize: '11px', color: '#424242', fontWeight: 600 }}>{msg.sender}</span>
                      <span style={{ fontSize: '10px', color: '#9E9E9E' }}>{msg.time}</span>
                    </div>
                    <div
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#F5F5F5',
                        borderRadius: 6,
                        border: '1px solid #E0E0E0',
                      }}
                    >
                      <p style={{ fontSize: '12px', color: '#424242', margin: 0 }}>{msg.text}</p>
                    </div>
                  </div>
                ))}
                <USTag ids={['US13']} />
              </div>

              {/* Input */}
              <div
                className="p-3 flex gap-2"
                style={{ borderTop: '1px solid #E0E0E0' }}
              >
                <input
                  placeholder="Escribe un mensaje..."
                  readOnly
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid #9E9E9E',
                    borderRadius: 4,
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                />
                <button
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#424242',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: '12px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Enviar
                </button>
              </div>
              <USTag ids={['US13']} className="px-3 pb-2" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Attention gauge */}
              <div className="flex justify-center">
                <AttentionGauge value={78} size={110} label="Mi índice de atención" />
              </div>
              <USTag ids={['US21']} className="justify-center" />

              <div style={{ height: 1, backgroundColor: '#E0E0E0' }} />

              {/* Camera capture status */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: '#424242' }}>Captura de cámara</span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#424242',
                      backgroundColor: '#E0E0E0',
                      padding: '2px 6px',
                      borderRadius: 10,
                    }}
                  >
                    Activa
                  </span>
                </div>
                <USTag ids={['US17']} />
              </div>

              {/* Head orientation */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: '#424242' }}>Orientación de cabeza</span>
                  <div className="flex items-center gap-1">
                    <ArrowUp size={14} color="#424242" />
                    <span style={{ fontSize: '11px', color: '#424242' }}>Frente</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 8px',
                    backgroundColor: '#F5F5F5',
                    border: '1px solid #E0E0E0',
                    borderRadius: 4,
                    fontSize: '11px',
                    color: '#9E9E9E',
                  }}
                >
                  ↑ Mirando al frente · Normal
                </div>
                <USTag ids={['US19']} />
              </div>

              {/* Posture analysis */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: '#424242' }}>Análisis de postura</span>
                  <span style={{ fontSize: '11px', color: '#424242' }}>Normal</span>
                </div>
                <div style={{ height: 6, backgroundColor: '#E0E0E0', borderRadius: 3 }}>
                  <div style={{ width: '80%', height: '100%', backgroundColor: '#424242', borderRadius: 3 }} />
                </div>
                <USTag ids={['US20']} />
              </div>

              {/* Lighting alert */}
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#F5F5F5',
                  border: '1px solid #9E9E9E',
                  borderRadius: 4,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={13} color="#424242" style={{ marginTop: 1 }} />
                <span style={{ fontSize: '11px', color: '#424242' }}>
                  Iluminación insuficiente detectada
                </span>
                <USTag ids={['US22']} className="ml-auto" />
              </div>

              <div style={{ height: 1, backgroundColor: '#E0E0E0' }} />

              {/* Privacy notice */}
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#F5F5F5',
                  border: '1px dashed #E0E0E0',
                  borderRadius: 4,
                }}
              >
                <div className="flex items-start gap-1.5">
                  <Eye size={12} color="#9E9E9E" style={{ marginTop: 2 }} />
                  <p style={{ fontSize: '10px', color: '#9E9E9E', margin: 0 }}>
                    Análisis procesado localmente — no se almacenan datos
                  </p>
                </div>
                <USTag ids={['US23']} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

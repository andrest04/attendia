import { useState } from 'react';
import {
  Mic, Camera, Monitor, Circle, Settings, PhoneOff,
  User, Hand, AlertTriangle, Download, TrendingUp
} from 'lucide-react';
import { VideoTile } from '../shared/VideoTile';
import { AttentionGauge } from '../shared/AttentionGauge';
import { ToolbarButton } from '../shared/ToolbarButton';
import { USTag } from '../shared/USTag';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

type AttentionLevel = 'high' | 'medium' | 'low';

const students: Array<{ id: number; name: string; attention: AttentionLevel; handRaised: boolean; multiface: boolean }> = [
  { id: 1, name: 'Ana García', attention: 'high', handRaised: false, multiface: false },
  { id: 2, name: 'Carlos López', attention: 'medium', handRaised: true, multiface: false },
  { id: 3, name: 'María Torres', attention: 'low', handRaised: false, multiface: true },
  { id: 4, name: 'Luis Pérez', attention: 'high', handRaised: false, multiface: false },
  { id: 5, name: 'Sofia Ruiz', attention: 'medium', handRaised: true, multiface: false },
  { id: 6, name: 'Diego Herrera', attention: 'low', handRaised: false, multiface: false },
  { id: 7, name: 'Valentina Cruz', attention: 'medium', handRaised: false, multiface: false },
  { id: 8, name: 'Andrés Morales', attention: 'high', handRaised: false, multiface: false },
  { id: 9, name: 'Isabella Vega', attention: 'low', handRaised: false, multiface: true },
  { id: 10, name: 'Felipe Romero', attention: 'medium', handRaised: false, multiface: false },
  { id: 11, name: 'Camila Diaz', attention: 'high', handRaised: false, multiface: false },
  { id: 12, name: 'Sebastián Lara', attention: 'medium', handRaised: false, multiface: false },
];

const attentionData = [
  { time: '0:00', value: 88 },
  { time: '0:05', value: 82 },
  { time: '0:10', value: 75 },
  { time: '0:15', value: 71 },
  { time: '0:20', value: 68 },
  { time: '0:25', value: 72 },
  { time: '0:30', value: 65 },
  { time: '0:35', value: 60 },
  { time: '0:40', value: 67 },
  { time: '0:45', value: 73 },
];

const attentionColors: Record<AttentionLevel, string> = {
  high: '#424242',
  medium: '#9E9E9E',
  low: '#E0E0E0',
};

const attentionLabels: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Med.',
  low: 'Bajo',
};

export function S4_ProfessorSession() {
  const [activeTab, setActiveTab] = useState<'grupo' | 'individual'>('grupo');
  const [recording, setRecording] = useState(true);

  const handsRaised = students.filter(s => s.handRaised);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 44px)', backgroundColor: '#F5F5F5' }}>
      {/* Top status bar */}
      <div
        className="flex items-center gap-3 px-4 py-1.5 flex-shrink-0"
        style={{ backgroundColor: '#424242', borderBottom: '1px solid #000' }}
      >
        {recording && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#9E9E9E] rounded">
            <Circle size={8} color="#FFFFFF" fill="#FFFFFF" />
            <span style={{ fontSize: '10px', color: '#FFFFFF', fontWeight: 600 }}>REC</span>
            <USTag ids={['US12']} className="ml-1" />
          </div>
        )}
        <span style={{ fontSize: '11px', color: '#9E9E9E' }}>
          Matemáticas — Grupo A · 12 estudiantes · 0:45:23
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '9px', color: '#666', fontStyle: 'italic' }}>
            Twilio Video · WebRTC SFU
          </span>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR: Participants + Hands */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 230,
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E0E0E0',
            overflowY: 'auto',
          }}
        >
          <div className="px-3 py-2 border-b border-[#E0E0E0]">
            <h4 style={{ color: '#000000', margin: 0, fontSize: '13px' }}>Participantes</h4>
          </div>

          {/* Hands raised queue */}
          {handsRaised.length > 0 && (
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #E0E0E0', backgroundColor: '#FAFAFA' }}>
              <span style={{ fontSize: '11px', color: '#424242', fontWeight: 600 }}>
                Manos levantadas ({handsRaised.length})
              </span>
              <div className="flex flex-col gap-2 mt-2">
                {handsRaised.map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Hand size={11} color="#424242" />
                    <span style={{ fontSize: '11px', color: '#424242', flex: 1 }}>{s.name}</span>
                    <button
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        backgroundColor: '#424242',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 3,
                        cursor: 'pointer',
                      }}
                    >
                      Dar turno
                    </button>
                  </div>
                ))}
              </div>
              <USTag ids={['US15']} />
            </div>
          )}

          {/* Participant list with attention badges */}
          <div className="flex-1 overflow-y-auto">
            {students.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: '1px solid #F5F5F5' }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    backgroundColor: '#E0E0E0',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={13} color="#9E9E9E" />
                </div>
                <span style={{ fontSize: '11px', color: '#424242', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                {s.handRaised && <Hand size={10} color="#424242" />}
                {s.multiface && <AlertTriangle size={10} color="#424242" />}
                {/* Attention badge */}
                <span
                  style={{
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: 2,
                    backgroundColor: attentionColors[s.attention],
                    color: s.attention === 'low' ? '#424242' : '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  {attentionLabels[s.attention]}
                </span>
              </div>
            ))}
            <USTag ids={['US04', 'US25']} className="px-3 py-1" />
          </div>
        </div>

        {/* CENTER: Gallery grid + toolbar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Gallery grid */}
          <div
            className="flex-1 overflow-y-auto p-3"
            style={{ backgroundColor: '#2A2A2A' }}
          >
            {/* Alert banner */}
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded"
              style={{ backgroundColor: '#3A3A3A', border: '1px solid #555' }}
            >
              <AlertTriangle size={13} color="#AAAAAA" />
              <span style={{ fontSize: '11px', color: '#AAAAAA' }}>
                Atención grupal por debajo del umbral (60%)
              </span>
              <USTag ids={['US28']} className="ml-auto" />
            </div>

            {/* Student tile grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              {students.map((s) => (
                <div key={s.id} className="flex flex-col">
                  <VideoTile
                    name={s.name}
                    height={100}
                    attentionLevel={s.attention}
                    showProctoringAlert={s.multiface}
                    showTwilio
                    connectionQuality="strong"
                  />
                  <USTag ids={['US08', 'US25']} />
                </div>
              ))}

              {/* Screen share tile */}
              <div className="flex flex-col">
                <VideoTile
                  name="Pantalla compartida"
                  height={100}
                  isScreenShare
                  showTwilio
                />
                <USTag ids={['US09']} />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span style={{ fontSize: '10px', color: '#666' }}>
                Mostrando 12 / 30 estudiantes
              </span>
              <USTag ids={['US08']} />
            </div>
          </div>

          {/* Bottom toolbar */}
          <div
            className="flex items-center justify-center gap-4 px-6 py-3 flex-shrink-0"
            style={{ backgroundColor: '#FFFFFF', borderTop: '2px solid #E0E0E0' }}
          >
            <ToolbarButton icon={Mic} label="Silenciar" active usId="US07" />
            <ToolbarButton icon={Camera} label="Cámara" active usId="US07" />
            <ToolbarButton icon={Monitor} label="Compartir" active usId="US09" />
            <ToolbarButton
              icon={Circle}
              label={recording ? 'Detener REC' : 'Grabar'}
              variant={recording ? 'active' : 'default'}
              onClick={() => setRecording(!recording)}
              usId="US12"
            />
            <ToolbarButton icon={Settings} label="Proctoring" active usId="US30" />
            <div style={{ width: 1, height: 32, backgroundColor: '#E0E0E0', margin: '0 8px' }} />
            <ToolbarButton icon={PhoneOff} label="Terminar sesión" variant="danger" usId="US05" />
          </div>
        </div>

        {/* RIGHT SIDEBAR: Analytics */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 300,
            backgroundColor: '#FFFFFF',
            borderLeft: '1px solid #E0E0E0',
          }}
        >
          {/* Tabs */}
          <div className="flex border-b border-[#E0E0E0]">
            {(['grupo', 'individual'] as const).map((tab) => (
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
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {tab === 'grupo' ? 'Grupo' : 'Individual'}
              </button>
            ))}
          </div>

          {activeTab === 'grupo' ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Group gauge */}
              <div className="flex justify-center">
                <AttentionGauge value={64} size={120} label="Atención grupal" />
              </div>
              <USTag ids={['US24']} className="justify-center" />

              {/* Alert banner */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded"
                style={{ backgroundColor: '#F5F5F5', border: '1px solid #9E9E9E' }}
              >
                <AlertTriangle size={13} color="#424242" />
                <span style={{ fontSize: '11px', color: '#424242' }}>
                  Atención grupal por debajo del umbral
                </span>
              </div>
              <USTag ids={['US28']} />

              <div style={{ height: 1, backgroundColor: '#E0E0E0' }} />

              {/* Timeline chart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>
                    Evolución temporal
                  </span>
                  <TrendingUp size={14} color="#9E9E9E" />
                </div>
                <div style={{ height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attentionData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9E9E9E' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9E9E9E' }} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#424242"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#424242' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <USTag ids={['US26']} />
              </div>

              {/* Export button */}
              <button
                className="flex items-center justify-center gap-2 w-full"
                style={{
                  padding: '10px',
                  border: '1px solid #9E9E9E',
                  borderRadius: 6,
                  backgroundColor: '#F5F5F5',
                  fontSize: '12px',
                  color: '#424242',
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Exportar reporte
              </button>
              <USTag ids={['US27']} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>
                  Atención individual
                </span>
                <button
                  style={{
                    fontSize: '10px',
                    color: '#9E9E9E',
                    background: 'none',
                    border: '1px solid #E0E0E0',
                    borderRadius: 3,
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  Ordenar ↓
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[...students]
                  .sort((a, b) => {
                    const order: Record<AttentionLevel, number> = { high: 0, medium: 1, low: 2 };
                    return order[a.attention] - order[b.attention];
                  })
                  .map((s) => {
                    const pct = s.attention === 'high' ? 85 : s.attention === 'medium' ? 60 : 35;
                    return (
                      <div key={s.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: '11px', color: '#424242' }}>{s.name}</span>
                          <span style={{ fontSize: '10px', color: '#9E9E9E' }}>{pct}</span>
                        </div>
                        <div style={{ height: 6, backgroundColor: '#E0E0E0', borderRadius: 3 }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: attentionColors[s.attention],
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <USTag ids={['US25']} className="mt-2" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

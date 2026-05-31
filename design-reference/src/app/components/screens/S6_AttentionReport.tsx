import { Download, FileText, TrendingUp, Calendar, Clock } from 'lucide-react';
import { USTag } from '../shared/USTag';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const timelineData = [
  { time: '0:00', grupo: 88, umbral: 65 },
  { time: '0:05', grupo: 84, umbral: 65 },
  { time: '0:10', grupo: 78, umbral: 65 },
  { time: '0:15', grupo: 73, umbral: 65 },
  { time: '0:20', grupo: 67, umbral: 65 },
  { time: '0:25', grupo: 70, umbral: 65 },
  { time: '0:30', grupo: 62, umbral: 65 },
  { time: '0:35', grupo: 58, umbral: 65 },
  { time: '0:40', grupo: 65, umbral: 65 },
  { time: '0:45', grupo: 69, umbral: 65 },
  { time: '0:50', grupo: 74, umbral: 65 },
  { time: '0:55', grupo: 72, umbral: 65 },
  { time: '1:00', grupo: 76, umbral: 65 },
];

const studentReport = [
  { id: 1, name: 'Ana García', avg: 82, min: 68, max: 95, alerts: 0 },
  { id: 2, name: 'Carlos López', avg: 71, min: 50, max: 88, alerts: 1 },
  { id: 3, name: 'María Torres', avg: 45, min: 20, max: 72, alerts: 3 },
  { id: 4, name: 'Luis Pérez', avg: 88, min: 75, max: 97, alerts: 0 },
  { id: 5, name: 'Sofia Ruiz', avg: 67, min: 42, max: 85, alerts: 1 },
  { id: 6, name: 'Diego Herrera', avg: 55, min: 30, max: 78, alerts: 2 },
  { id: 7, name: 'Valentina Cruz', avg: 74, min: 58, max: 91, alerts: 0 },
  { id: 8, name: 'Andrés Morales', avg: 90, min: 80, max: 98, alerts: 0 },
  { id: 9, name: 'Isabella Vega', avg: 40, min: 18, max: 65, alerts: 4 },
  { id: 10, name: 'Felipe Romero', avg: 63, min: 44, max: 82, alerts: 1 },
  { id: 11, name: 'Camila Diaz', avg: 85, min: 72, max: 96, alerts: 0 },
  { id: 12, name: 'Sebastián Lara', avg: 60, min: 35, max: 79, alerts: 2 },
];

function getAttentionColor(val: number): string {
  if (val >= 75) return '#424242';
  if (val >= 55) return '#9E9E9E';
  return '#000000';
}

export function S6_AttentionReport() {
  const avgGroup = Math.round(studentReport.reduce((sum, s) => sum + s.avg, 0) / studentReport.length);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Page wrapper */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>

        {/* Header */}
        <div
          className="flex items-start justify-between mb-6 p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8 }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileText size={20} color="#424242" />
              <h2 style={{ color: '#000000', margin: 0 }}>Reporte de Atención</h2>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '12px', color: '#9E9E9E' }}>Sesión:</span>
                <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>Matemáticas — Grupo A</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} color="#9E9E9E" />
                <span style={{ fontSize: '12px', color: '#9E9E9E' }}>9 de mayo, 2026</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} color="#9E9E9E" />
                <span style={{ fontSize: '12px', color: '#9E9E9E' }}>10:00 — 11:05 (1h 5min)</span>
              </div>
            </div>
            <div
              style={{
                padding: '3px 8px',
                backgroundColor: '#F5F5F5',
                borderRadius: 3,
                border: '1px solid #E0E0E0',
                display: 'inline-block',
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: '10px', color: '#9E9E9E' }}>EP06 — Reporte Post-sesión · US26, US27</span>
            </div>
          </div>

          {/* Download buttons */}
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2"
              style={{
                padding: '9px 16px',
                border: '1px solid #9E9E9E',
                borderRadius: 6,
                backgroundColor: '#F5F5F5',
                fontSize: '13px',
                color: '#424242',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Descargar PDF
            </button>
            <button
              className="flex items-center gap-2"
              style={{
                padding: '9px 16px',
                border: '1px solid #424242',
                borderRadius: 6,
                backgroundColor: '#424242',
                fontSize: '13px',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Descargar CSV
            </button>
            <USTag ids={['US27']} />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Índice promedio grupo', value: `${avgGroup}`, sub: '/ 100' },
            { label: 'Estudiantes monitoreados', value: '12', sub: 'participantes' },
            { label: 'Alertas de proctoring', value: '14', sub: 'eventos detectados' },
            { label: 'Umbral superado', value: '38%', sub: 'del tiempo total' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <p style={{ fontSize: '11px', color: '#9E9E9E', margin: '0 0 6px 0' }}>{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <span style={{ fontSize: '26px', color: '#000000', fontWeight: 700 }}>{stat.value}</span>
                <span style={{ fontSize: '12px', color: '#9E9E9E' }}>{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline chart */}
        <div
          className="mb-6 p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} color="#424242" />
              <h3 style={{ color: '#000000', margin: 0 }}>Evolución de atención grupal</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div style={{ width: 16, height: 2, backgroundColor: '#424242' }} />
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Atención grupo</span>
              </div>
              <div className="flex items-center gap-1">
                <div style={{ width: 16, height: 2, backgroundColor: '#E0E0E0', borderTop: '2px dashed #9E9E9E' }} />
                <span style={{ fontSize: '10px', color: '#9E9E9E' }}>Umbral mínimo (65%)</span>
              </div>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9E9E9E' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9E9E9E' }} />
                <Tooltip contentStyle={{ fontSize: 11, backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0' }} />
                <Line type="monotone" dataKey="grupo" name="Atención grupo" stroke="#424242" strokeWidth={2} dot={{ r: 3, fill: '#424242' }} />
                <Line type="monotone" dataKey="umbral" name="Umbral" stroke="#9E9E9E" strokeWidth={1} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <USTag ids={['US26']} className="mt-2" />
        </div>

        {/* Student table */}
        <div
          className="p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8 }}
        >
          <h3 style={{ color: '#000000', margin: '0 0 16px 0' }}>Detalle por estudiante</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
                {['Nombre del estudiante', 'Índice prom.', 'Mínimo', 'Máximo', 'Alertas proctoring', 'Nivel'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: '#9E9E9E',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentReport.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid #F5F5F5',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#424242' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 60, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3 }}>
                        <div
                          style={{
                            width: `${s.avg}%`,
                            height: '100%',
                            backgroundColor: getAttentionColor(s.avg),
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', color: '#424242', fontWeight: 500 }}>{s.avg}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#9E9E9E' }}>{s.min}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#9E9E9E' }}>{s.max}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: s.alerts > 0 ? '#424242' : '#9E9E9E' }}>
                    {s.alerts > 0 ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#424242',
                          color: '#FFFFFF',
                          borderRadius: 10,
                          fontSize: '11px',
                        }}
                      >
                        {s.alerts}
                      </span>
                    ) : (
                      <span style={{ color: '#9E9E9E', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: 2,
                        backgroundColor: s.avg >= 75 ? '#424242' : s.avg >= 55 ? '#9E9E9E' : '#E0E0E0',
                        color: s.avg >= 75 ? '#FFFFFF' : s.avg >= 55 ? '#FFFFFF' : '#424242',
                      }}
                    >
                      {s.avg >= 75 ? 'Alto' : s.avg >= 55 ? 'Medio' : 'Bajo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <USTag ids={['US26', 'US27']} className="mt-3" />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { wf } from '../wireframe';
import { attentionLevel, AttentionLevel } from '../data';

const arcColor: Record<AttentionLevel, string> = {
  high: wf.gray700,
  medium: wf.gray500,
  low: wf.gray300,
};

interface AttentionGaugeProps {
  /** Score 0–100. */
  value?: number;
  size?: number;
  label?: string;
}

/**
 * US21 — circular attention-index gauge. Design mock.
 *
 * Pure SVG (no chart lib). The arc fill is derived from `value` via the shared
 * `attentionLevel` ranges so it stays consistent with the rest of the screens.
 */
export default function AttentionGauge({ value = 72, size = 120, label = 'Índice de Atención' }: AttentionGaugeProps) {
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = arcColor[attentionLevel(clamped)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={wf.gray300} strokeWidth={10} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.22} fontWeight={600} fill={wf.gray700}>
          {clamped}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={size * 0.09} fill={wf.gray500}>
          / 100
        </text>
      </svg>
      <span style={{ fontSize: 11, color: wf.gray700, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

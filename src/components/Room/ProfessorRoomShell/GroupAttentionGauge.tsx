import React from 'react';
import { AttentionLevel } from '../../AttentionProvider/types';

const levelColor: Record<AttentionLevel, string> = {
  high: '#14B053',
  medium: '#E6A817',
  low: '#E22525',
};

interface Props {
  /** Group attention index 0–100. */
  value: number;
  /** Attention level, used to color the arc. */
  level: AttentionLevel;
  size?: number;
}

/**
 * Circular SVG gauge for the group attention index (US24). The arc is colored
 * by attention level; the numeric value is rendered as HTML centered over the
 * ring so it stays accessible and testable.
 */
export default function GroupAttentionGauge({ value, level, size = 120 }: Props) {
  const radius = 42;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }} data-testid="professor-room-shell-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E4E7E9" strokeWidth={10} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={levelColor[level]}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: size * 0.3, fontWeight: 700, color: '#282A2B' }}>{clamped}</span>
        <span style={{ fontSize: size * 0.1, color: '#606B85', marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

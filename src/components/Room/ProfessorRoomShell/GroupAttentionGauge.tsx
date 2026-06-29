import React from 'react';
import { AttentionLevel } from '../../AttentionProvider/types';

const levelArcColor: Record<AttentionLevel, string> = {
  high: '#10b981',
  medium: '#ffb800',
  low: '#ef4444',
};

const levelTrackColor: Record<AttentionLevel, string> = {
  high: '#d1fae5',
  medium: '#fff8e1',
  low: '#fee2e2',
};

interface Props {
  /** Group attention index 0–100. */
  value: number;
  /** Attention level, used to color the arc. */
  level: AttentionLevel;
  /**
   * False when there is no live reading (low connection / no measured students).
   * The gauge then shows a neutral "—" with an empty grey arc instead of "0",
   * which would read as "zero attention" rather than "no data".
   */
  available?: boolean;
  size?: number;
}

/**
 * Circular SVG gauge for the group attention index. The arc color
 * reflects the attention level (green=high, amber=medium, red=low).
 */
export default function GroupAttentionGauge({ value, level, available = true, size = 140 }: Props) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  // No data → empty arc, neutral grey, "—" readout. The level color is irrelevant.
  const offset = available ? circumference - (clamped / 100) * circumference : circumference;
  const arcColor = available ? levelArcColor[level] : '#cbd5e1';
  const trackColor = available ? levelTrackColor[level] : '#f1f5f9';

  return (
    <div style={{ position: 'relative', width: size, height: size }} data-testid="professor-room-shell-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Track ring */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        {/* Value arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
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
        <span
          style={{
            fontSize: size * 0.27,
            fontWeight: 700,
            color: '#1d2f6f',
            fontFamily: 'Poppins, Inter, sans-serif',
          }}
        >
          {available ? clamped : '—'}
        </span>
        <span
          style={{
            fontSize: size * 0.09,
            color: '#64748b',
            marginTop: 2,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

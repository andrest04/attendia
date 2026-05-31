interface AttentionGaugeProps {
  value?: number;
  size?: number;
  label?: string;
}

export function AttentionGauge({ value = 72, size = 120, label = 'Índice de Atención' }: AttentionGaugeProps) {
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#E0E0E0"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#424242"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* Value label */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight="600"
          fill="#424242"
          fontFamily="Inter, sans-serif"
        >
          {value}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize={size * 0.09}
          fill="#9E9E9E"
          fontFamily="Inter, sans-serif"
        >
          / 100
        </text>
      </svg>
      <span style={{ fontSize: '11px', color: '#424242', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

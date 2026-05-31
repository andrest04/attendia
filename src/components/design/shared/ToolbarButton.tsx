import React from 'react';
import { wf } from '../wireframe';

type Variant = 'default' | 'danger' | 'active';

interface ToolbarButtonProps {
  /** A Material-UI icon component (e.g. `MicIcon`). */
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: Variant;
  onClick?: () => void;
  usId?: string;
}

/** In-call toolbar action button (mic, cam, share, hand, chat, leave). Design mock. */
export default function ToolbarButton({
  icon: Icon,
  label,
  active = true,
  disabled = false,
  variant = 'default',
  onClick,
  usId,
}: ToolbarButtonProps) {
  const bg = disabled
    ? wf.bg
    : variant === 'danger' || variant === 'active'
    ? wf.gray700
    : active
    ? wf.gray300
    : wf.gray500;

  const iconColor = disabled
    ? wf.gray500
    : variant === 'danger' || variant === 'active'
    ? wf.white
    : active
    ? wf.gray700
    : wf.white;

  const textColor = disabled ? wf.gray500 : wf.gray700;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: 44,
          height: 44,
          backgroundColor: bg,
          border: `1px solid ${disabled ? wf.gray300 : wf.gray500}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon style={{ fontSize: 18, color: iconColor }} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: textColor, textAlign: 'center', maxWidth: 56 }}>{label}</span>
        {usId && (
          <span
            style={{
              fontSize: 8,
              color: wf.gray500,
              border: `1px solid ${wf.gray300}`,
              padding: '0 3px',
              borderRadius: 2,
            }}
          >
            [{usId}]
          </span>
        )}
      </div>
    </div>
  );
}

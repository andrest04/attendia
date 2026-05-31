import { LucideIcon } from 'lucide-react';

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'active';
  onClick?: () => void;
  usId?: string;
}

export function ToolbarButton({
  icon: Icon,
  label,
  active = true,
  disabled = false,
  variant = 'default',
  onClick,
  usId,
}: ToolbarButtonProps) {
  const bg = disabled
    ? '#F5F5F5'
    : variant === 'danger'
    ? '#424242'
    : variant === 'active'
    ? '#424242'
    : active
    ? '#E0E0E0'
    : '#9E9E9E';

  const iconColor = disabled
    ? '#9E9E9E'
    : variant === 'danger' || variant === 'active'
    ? '#FFFFFF'
    : active
    ? '#424242'
    : '#FFFFFF';

  const textColor = disabled ? '#9E9E9E' : '#424242';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: 44,
          height: 44,
          backgroundColor: bg,
          border: `1px solid ${disabled ? '#E0E0E0' : '#9E9E9E'}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon size={18} color={iconColor} />
      </button>
      <div className="flex flex-col items-center">
        <span style={{ fontSize: '9px', color: textColor, textAlign: 'center', maxWidth: 52 }}>
          {label}
        </span>
        {usId && (
          <span style={{ fontSize: '8px', color: '#9E9E9E', border: '1px solid #E0E0E0', padding: '0 3px', borderRadius: 2 }}>
            [{usId}]
          </span>
        )}
      </div>
    </div>
  );
}

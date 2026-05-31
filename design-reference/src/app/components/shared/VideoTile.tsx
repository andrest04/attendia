import { Camera, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { USTag } from './USTag';

type ConnectionQuality = 'strong' | 'medium' | 'weak';
type AttentionLevel = 'high' | 'medium' | 'low' | null;

interface VideoTileProps {
  name?: string;
  width?: string | number;
  height?: number;
  showTwilio?: boolean;
  attentionLevel?: AttentionLevel;
  showProctoringAlert?: boolean;
  connectionQuality?: ConnectionQuality;
  isScreenShare?: boolean;
  isLarge?: boolean;
  className?: string;
}

const attentionFill: Record<string, string> = {
  high: '#424242',
  medium: '#9E9E9E',
  low: '#E0E0E0',
};

const attentionLabel: Record<string, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

export function VideoTile({
  name = 'Participante',
  height = 180,
  showTwilio = true,
  attentionLevel = null,
  showProctoringAlert = false,
  connectionQuality = 'strong',
  isScreenShare = false,
  isLarge = false,
  className = '',
}: VideoTileProps) {
  return (
    <div
      className={`relative flex flex-col bg-[#E0E0E0] border border-[#9E9E9E] rounded overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* Main placeholder area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        {isScreenShare ? (
          <>
            <div className="w-16 h-12 bg-[#9E9E9E] rounded" />
            <span style={{ fontSize: '11px', color: '#424242' }}>Pantalla compartida</span>
          </>
        ) : (
          <>
            <Camera size={isLarge ? 40 : 24} color="#9E9E9E" />
            {isLarge && (
              <span style={{ fontSize: '12px', color: '#9E9E9E' }}>Vista de cámara</span>
            )}
          </>
        )}
      </div>

      {/* Bottom bar: name + badges */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#424242]" style={{ minHeight: 28 }}>
        <span style={{ fontSize: '11px', color: '#F5F5F5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
          {name}
        </span>
        <div className="flex items-center gap-1">
          {/* Attention badge */}
          {attentionLevel && (
            <span
              style={{
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '2px',
                backgroundColor: attentionFill[attentionLevel],
                color: attentionLevel === 'low' ? '#424242' : '#F5F5F5',
              }}
            >
              {attentionLabel[attentionLevel]}
            </span>
          )}
          {/* Connection quality */}
          {connectionQuality === 'weak' ? (
            <WifiOff size={10} color="#F5F5F5" />
          ) : (
            <Wifi size={10} color={connectionQuality === 'strong' ? '#F5F5F5' : '#9E9E9E'} />
          )}
          {/* Twilio label */}
          {showTwilio && (
            <span style={{ fontSize: '8px', color: '#9E9E9E', fontStyle: 'italic' }}>Twilio</span>
          )}
        </div>
      </div>

      {/* Proctoring alert overlay */}
      {showProctoringAlert && (
        <div
          className="absolute top-1 right-1 flex items-center gap-1 px-1 py-0.5 bg-[#424242] rounded"
        >
          <AlertTriangle size={10} color="#F5F5F5" />
          <span style={{ fontSize: '9px', color: '#F5F5F5' }}>Multi-rostro</span>
        </div>
      )}
    </div>
  );
}

// Compact tile for gallery grid
interface CompactTileProps {
  name: string;
  attentionLevel?: AttentionLevel;
  showProctoringAlert?: boolean;
  usIds?: string[];
}

export function CompactVideoTile({ name, attentionLevel, showProctoringAlert, usIds }: CompactTileProps) {
  return (
    <div className="flex flex-col">
      <VideoTile
        name={name}
        height={100}
        attentionLevel={attentionLevel}
        showProctoringAlert={showProctoringAlert}
        showTwilio
      />
      {usIds && <USTag ids={usIds} />}
    </div>
  );
}

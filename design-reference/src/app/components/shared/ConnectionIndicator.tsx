import { Wifi, WifiOff } from 'lucide-react';
import { USTag } from './USTag';

type Quality = 'strong' | 'medium' | 'weak';

interface ConnectionIndicatorProps {
  quality?: Quality;
  showLabel?: boolean;
  showUS?: boolean;
}

const labels: Record<Quality, string> = {
  strong: 'Conexión estable',
  medium: 'Conexión media',
  weak: 'Conexión débil',
};

const colors: Record<Quality, string> = {
  strong: '#424242',
  medium: '#9E9E9E',
  weak: '#9E9E9E',
};

export function ConnectionIndicator({ quality = 'strong', showLabel = true, showUS = false }: ConnectionIndicatorProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F5] border border-[#E0E0E0] rounded">
        {quality === 'weak' ? (
          <WifiOff size={14} color={colors[quality]} />
        ) : (
          <Wifi size={14} color={colors[quality]} />
        )}
        {showLabel && (
          <span style={{ fontSize: '11px', color: colors[quality] }}>{labels[quality]}</span>
        )}
        {/* Signal bars visual */}
        <div className="flex items-end gap-0.5 ml-1">
          <div className="w-1 rounded-sm" style={{ height: 4, backgroundColor: '#424242' }} />
          <div className="w-1 rounded-sm" style={{ height: 7, backgroundColor: quality !== 'weak' ? '#424242' : '#E0E0E0' }} />
          <div className="w-1 rounded-sm" style={{ height: 10, backgroundColor: quality === 'strong' ? '#424242' : '#E0E0E0' }} />
        </div>
      </div>
      {showUS && <USTag ids={['US11']} />}
    </div>
  );
}

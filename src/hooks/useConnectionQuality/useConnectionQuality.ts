import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Pre-connect connection quality, derived from the browser's Network Information
 * API (`navigator.connection.effectiveType`). This is a coarse, free signal that
 * needs no Twilio token and no test room — unlike in-room network quality, which
 * the app reads separately via `useParticipantNetworkQualityLevel` once a Room
 * exists. Browsers without the API (Safari, Firefox) report `unknown`.
 */
export type ConnectionQuality = 'good' | 'medium' | 'poor' | 'unknown';

export interface ConnectionQualityInfo {
  quality: ConnectionQuality;
  label: string;
}

/** Translation key (namespace `room`) of the label for each bucket: adding a bucket is adding a row. */
const QUALITY_LABEL_KEYS: Record<ConnectionQuality, string> = {
  good: 'connectionQuality.good',
  medium: 'connectionQuality.medium',
  poor: 'connectionQuality.poor',
  unknown: 'connectionQuality.unknown',
};

/** Maps an `effectiveType` value to our coarse quality buckets. */
export function mapEffectiveType(effectiveType?: string): ConnectionQuality {
  switch (effectiveType) {
    case '4g':
      return 'good';
    case '3g':
      return 'medium';
    case '2g':
    case 'slow-2g':
      return 'poor';
    default:
      return 'unknown';
  }
}

export default function useConnectionQuality(): ConnectionQualityInfo {
  const { t } = useTranslation('room');
  const [quality, setQuality] = useState<ConnectionQuality>(() =>
    mapEffectiveType(navigator.connection?.effectiveType)
  );

  useEffect(() => {
    const connection = navigator.connection;
    if (!connection) {
      return;
    }

    const handleChange = () => setQuality(mapEffectiveType(connection.effectiveType));
    handleChange();
    connection.addEventListener('change', handleChange);

    return () => connection.removeEventListener('change', handleChange);
  }, []);

  return { quality, label: t(QUALITY_LABEL_KEYS[quality]) };
}

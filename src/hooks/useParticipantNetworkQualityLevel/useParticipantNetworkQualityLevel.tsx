import { useEffect, useState } from 'react';
import { Participant } from 'twilio-video';

export default function useParticipantNetworkQualityLevel(participant: Participant | null) {
  const [networkQualityLevel, setNetworkQualityLevel] = useState<number | null>(
    participant?.networkQualityLevel ?? null
  );

  useEffect(() => {
    if (!participant) {
      setNetworkQualityLevel(null);
      return;
    }

    const handleNewtorkQualityLevelChange = (newNetworkQualityLevel: number) =>
      setNetworkQualityLevel(newNetworkQualityLevel);

    setNetworkQualityLevel(participant.networkQualityLevel);
    participant.on('networkQualityLevelChanged', handleNewtorkQualityLevelChange);
    return () => {
      participant.off('networkQualityLevelChanged', handleNewtorkQualityLevelChange);
    };
  }, [participant]);

  return networkQualityLevel;
}

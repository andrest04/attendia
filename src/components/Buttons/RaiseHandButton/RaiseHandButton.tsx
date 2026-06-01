import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import PanToolIcon from '@material-ui/icons/PanTool';

// SEAM: raise-hand has no transport yet — local-only stub.
// Real signaling (DataTrack/Conversations) is deferred (decision #6).

/**
 * RaiseHandButton — toggles a LOCAL boolean state only.
 * No network calls are made; this is a visual stub pending signaling integration.
 */
interface RaiseHandButtonProps {
  handRaised?: boolean;
  onHandRaisedChange?: (next: boolean) => void;
}

export default function RaiseHandButton({
  handRaised: controlledHandRaised,
  onHandRaisedChange,
}: RaiseHandButtonProps = {}) {
  const [uncontrolledHandRaised, setUncontrolledHandRaised] = useState(false);
  const handRaised = controlledHandRaised ?? uncontrolledHandRaised;

  const toggle = () => {
    const next = !handRaised;
    onHandRaisedChange?.(next);

    if (controlledHandRaised === undefined) {
      setUncontrolledHandRaised(next);
    }
  };

  return (
    <Button
      onClick={toggle}
      startIcon={<PanToolIcon />}
      aria-label={handRaised ? 'Bajar la mano' : 'Levantar la mano'}
      aria-pressed={handRaised}
      data-testid="raise-hand-button"
      style={handRaised ? { backgroundColor: '#027AC5', color: '#FFFFFF' } : undefined}
    >
      {handRaised ? 'Bajar mano' : 'Levantar mano'}
    </Button>
  );
}

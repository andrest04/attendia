import React, { useState } from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import PanToolIcon from '@material-ui/icons/PanTool';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';

/**
 * RaiseHandButton — presentational toggle. Intentionally transport-agnostic:
 * it only flips a boolean and reports it via onHandRaisedChange. The real
 * raise-hand signaling (a Twilio LocalDataTrack) lives in useRaiseHand, which
 * owns the controlled state when this button is rendered inside the room.
 * The uncontrolled fallback exists only for tests/Storybook.
 */
interface RaiseHandButtonProps {
  handRaised?: boolean;
  onHandRaisedChange?: (next: boolean) => void;
  className?: string;
}

export default function RaiseHandButton({
  handRaised: controlledHandRaised,
  onHandRaisedChange,
  className,
}: RaiseHandButtonProps = {}) {
  const [uncontrolledHandRaised, setUncontrolledHandRaised] = useState(false);
  const handRaised = controlledHandRaised ?? uncontrolledHandRaised;
  const classes = useToolbarButtonStyles();

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
      className={clsx(classes.toolbarButton, { [classes.toolbarButtonActive]: handRaised }, className)}
    >
      {handRaised ? 'Bajar mano' : 'Levantar mano'}
    </Button>
  );
}

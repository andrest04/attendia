import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import PanToolIcon from '@material-ui/icons/PanTool';
import { toolbarButtonClass, useToolbarButtonStyles } from '../toolbarButtonStyles';
import { t } from '../../../i18n/translate';

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
  iconOnly?: boolean;
  /** Renders as a bare icon (no inner circle) so a circular wrapping chip is the only shape. */
  plain?: boolean;
}

export default function RaiseHandButton({
  handRaised: controlledHandRaised,
  onHandRaisedChange,
  className,
  iconOnly,
  plain,
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
      aria-label={t(handRaised ? 'Bajar la mano' : 'Levantar la mano')}
      aria-pressed={handRaised}
      data-testid="raise-hand-button"
      className={toolbarButtonClass(classes, { active: handRaised, plain, className })}
    >
      {iconOnly ? null : t(handRaised ? 'Bajar mano' : 'Levantar mano')}
    </Button>
  );
}

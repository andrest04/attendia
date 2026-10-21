import React from 'react';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';

export const UNMUTE_REQUEST_TEXT = 'El profesor te pide activar tu micrófono';

interface UnmuteRequestPromptProps {
  /** True while the professor's "turn your mic on" request is unanswered. */
  open: boolean;
  /** The student's click: the ONLY place the microphone gets enabled. */
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * Student-side prompt for the professor's unmute request. Persistent (no auto-hide) so the
 * request is not lost, and it never touches the microphone by itself.
 */
export default function UnmuteRequestPrompt({ open, onAccept, onDismiss }: UnmuteRequestPromptProps) {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={UNMUTE_REQUEST_TEXT}
      data-testid="unmute-request-prompt"
      action={
        <>
          <Button color="inherit" size="small" onClick={onDismiss}>
            Ahora no
          </Button>
          <Button color="secondary" size="small" onClick={onAccept}>
            Activar
          </Button>
        </>
      }
    />
  );
}

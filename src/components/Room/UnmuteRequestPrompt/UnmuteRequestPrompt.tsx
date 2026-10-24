import React from 'react';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import { t } from '../../../i18n/translate';

export const UNMUTE_REQUEST_TEXT = 'El profesor te pide activar tu micrófono';
export const CAMERA_REQUEST_TEXT = 'El profesor te sugiere encender tu cámara';

export type RequestKind = 'mic' | 'camera';

/** Copy and test id per kind: adding a kind is adding a row. */
const KIND_VIEW: Record<RequestKind, { text: string; testId: string }> = {
  mic: { text: UNMUTE_REQUEST_TEXT, testId: 'unmute-request-prompt' },
  camera: { text: CAMERA_REQUEST_TEXT, testId: 'camera-request-prompt' },
};

interface UnmuteRequestPromptProps {
  /** What the professor asks to turn on. Defaults to the microphone. */
  kind?: RequestKind;
  /** True while the professor's "turn your mic on" request is unanswered. */
  open: boolean;
  /** The student's click: the ONLY place the microphone or camera gets enabled. */
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * Student-side prompt for the professor's request to turn the mic or camera on. Persistent (no auto-hide) so the
 * request is not lost, and it never touches the microphone or camera by itself.
 */
export default function UnmuteRequestPrompt({ kind = 'mic', open, onAccept, onDismiss }: UnmuteRequestPromptProps) {
  const view = KIND_VIEW[kind];
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={t(view.text)}
      data-testid={view.testId}
      action={
        <>
          <Button color="inherit" size="small" onClick={onDismiss}>
            {t('Ahora no')}
          </Button>
          <Button color="secondary" size="small" onClick={onAccept}>
            {t('Activar')}
          </Button>
        </>
      }
    />
  );
}

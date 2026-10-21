import React from 'react';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import { useTranslation } from 'react-i18next';

// Translation keys (namespace-qualified): resolve them with `t`.
export const UNMUTE_REQUEST_KEY = 'toolbar:unmuteRequest.mic';
export const CAMERA_REQUEST_KEY = 'toolbar:unmuteRequest.camera';

export type RequestKind = 'mic' | 'camera';

/** Copy and test id per kind: adding a kind is adding a row. */
const KIND_VIEW: Record<RequestKind, { textKey: string; testId: string }> = {
  mic: { textKey: UNMUTE_REQUEST_KEY, testId: 'unmute-request-prompt' },
  camera: { textKey: CAMERA_REQUEST_KEY, testId: 'camera-request-prompt' },
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
  const { t } = useTranslation('toolbar');
  const view = KIND_VIEW[kind];
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={t(view.textKey)}
      data-testid={view.testId}
      action={
        <>
          <Button color="inherit" size="small" onClick={onDismiss}>
            {t('unmuteRequest.notNow')}
          </Button>
          <Button color="secondary" size="small" onClick={onAccept}>
            {t('unmuteRequest.enable')}
          </Button>
        </>
      }
    />
  );
}

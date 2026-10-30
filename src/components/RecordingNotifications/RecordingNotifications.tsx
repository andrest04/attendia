import React, { useEffect, useRef, useState } from 'react';
import { Link } from '@material-ui/core';
import { useTranslation } from 'react-i18next';
import Snackbar from '../Snackbar/Snackbar';
import useIsRecording from '../../hooks/useIsRecording/useIsRecording';

enum Snackbars {
  none,
  recordingStarted,
  recordingInProgress,
  recordingFinished,
}

export default function RecordingNotifications() {
  const { t } = useTranslation();
  const [activeSnackbar, setActiveSnackbar] = useState(Snackbars.none);
  const prevIsRecording = useRef<boolean | null>(null);
  const isRecording = useIsRecording();

  useEffect(() => {
    // Show "Recording in progress" snackbar when a user joins a room that is recording
    if (isRecording && prevIsRecording.current === null) {
      setActiveSnackbar(Snackbars.recordingInProgress);
    }
  }, [isRecording]);

  useEffect(() => {
    // Show "Recording started" snackbar when recording has started.
    if (isRecording && prevIsRecording.current === false) {
      setActiveSnackbar(Snackbars.recordingStarted);
    }
  }, [isRecording]);

  useEffect(() => {
    // Show "Recording finished" snackbar when recording has stopped.
    if (!isRecording && prevIsRecording.current === true) {
      setActiveSnackbar(Snackbars.recordingFinished);
    }
  }, [isRecording]);

  useEffect(() => {
    prevIsRecording.current = isRecording;
  }, [isRecording]);

  return (
    <>
      <Snackbar
        open={activeSnackbar === Snackbars.recordingStarted}
        handleClose={() => setActiveSnackbar(Snackbars.none)}
        variant="info"
        headline={t('recordingNotifications.started')}
        message=""
      />
      <Snackbar
        open={activeSnackbar === Snackbars.recordingInProgress}
        handleClose={() => setActiveSnackbar(Snackbars.none)}
        variant="info"
        headline={t('recordingNotifications.inProgress')}
        message=""
      />
      <Snackbar
        open={activeSnackbar === Snackbars.recordingFinished}
        headline={t('recordingNotifications.complete')}
        message={
          <>
            {t('recordingNotifications.beforeLink')}{' '}
            <Link target="_blank" rel="noopener" href="https://www.twilio.com/console/video/logs/recordings">
              {t('recordingNotifications.link')}
            </Link>
            {t('recordingNotifications.afterLink')}
          </>
        }
        variant="info"
        handleClose={() => setActiveSnackbar(Snackbars.none)}
      />
    </>
  );
}

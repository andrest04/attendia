import React from 'react';
import Video from 'twilio-video';
import { Container, Link, Typography, Paper, Grid } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
  container: {
    marginTop: '2.5em',
  },
  paper: {
    padding: '1em',
  },
  heading: {
    marginBottom: '0.4em',
  },
});

export default function UnsupportedBrowserWarning({ children }: { children: React.ReactElement }) {
  const classes = useStyles();
  const { t } = useTranslation('misc');

  if (!Video.isSupported) {
    return (
      <Container>
        <Grid container justifyContent="center" className={classes.container}>
          <Grid item xs={12} sm={6}>
            <Paper className={classes.paper}>
              <Typography variant="h4" className={classes.heading}>
                {t('unsupportedBrowser.title')}
              </Typography>
              <Typography>
                {t('unsupportedBrowser.openIn')}{' '}
                <Link
                  href="https://www.twilio.com/docs/video/javascript#supported-browsers"
                  target="_blank"
                  rel="noopener"
                >
                  {t('unsupportedBrowser.supportedBrowsers')}
                </Link>
                {t('unsupportedBrowser.afterLink')}
                <br />
                {t('unsupportedBrowser.secureIntro')}{' '}
                <Link
                  href="https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts"
                  target="_blank"
                  rel="noopener"
                >
                  {t('unsupportedBrowser.secureContext')}
                </Link>{' '}
                {t('unsupportedBrowser.secureExample')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return children;
}

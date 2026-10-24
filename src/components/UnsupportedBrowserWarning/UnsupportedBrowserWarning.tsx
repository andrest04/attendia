import React from 'react';
import Video from 'twilio-video';
import { Container, Link, Typography, Paper, Grid } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { t } from '../../i18n/translate';

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

  if (!Video.isSupported) {
    return (
      <Container>
        <Grid container justifyContent="center" className={classes.container}>
          <Grid item xs={12} sm={6}>
            <Paper className={classes.paper}>
              <Typography variant="h4" className={classes.heading}>
                {t('Navegador o contexto no compatible')}
              </Typography>
              <Typography>
                {t('Abre esta aplicación en uno de los')}{' '}
                <Link
                  href="https://www.twilio.com/docs/video/javascript#supported-browsers"
                  target="_blank"
                  rel="noopener"
                >
                  {t('navegadores compatibles')}
                </Link>
                .
                <br />
                {t('Si usas un navegador compatible, asegúrate de que esta aplicación se sirva en un')}{' '}
                <Link
                  href="https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts"
                  target="_blank"
                  rel="noopener"
                >
                  {t('contexto seguro')}
                </Link>{' '}
                {t('(p. ej., https o localhost).')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return children;
}

import React from 'react';
import { Container, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { t } from '../../i18n/translate';

const useStyles = makeStyles({
  container: { marginTop: '2.5em' },
  paper: { padding: '1.5em', textAlign: 'center' },
  heading: { marginBottom: '0.4em' },
});

export default function PhoneBlockedScreen() {
  const classes = useStyles();

  return (
    <Container maxWidth="sm" className={classes.container}>
      <Paper className={classes.paper}>
        <Typography variant="h5" className={classes.heading}>
          {t('Esta plataforma no está disponible en celulares')}
        </Typography>
        <Typography>{t('Ingresa desde un computador o tablet.')}</Typography>
      </Paper>
    </Container>
  );
}

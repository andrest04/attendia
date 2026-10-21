import React from 'react';
import { Container, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
  container: { marginTop: '2.5em' },
  paper: { padding: '1.5em', textAlign: 'center' },
  heading: { marginBottom: '0.4em' },
});

export default function PhoneBlockedScreen() {
  const classes = useStyles();
  const { t } = useTranslation('misc');

  return (
    <Container maxWidth="sm" className={classes.container}>
      <Paper className={classes.paper}>
        <Typography variant="h5" className={classes.heading}>
          {t('phoneBlocked.title')}
        </Typography>
        <Typography>{t('phoneBlocked.hint')}</Typography>
      </Paper>
    </Container>
  );
}

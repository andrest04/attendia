import React from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import CloseIcon from '../../../icons/CloseIcon';

const useStyles = makeStyles(() =>
  createStyles({
    container: {
      minHeight: '56px',
      background: '#F4F4F6',
      borderBottom: '1px solid #E4E7E9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 1em',
    },
    text: {
      fontWeight: 'bold',
    },
    closeBackgroundSelection: {
      cursor: 'pointer',
      display: 'flex',
      background: 'transparent',
      border: '0',
      padding: '0.4em',
    },
  })
);

interface BackgroundSelectionHeaderProps {
  onClose: () => void;
}

export default function BackgroundSelectionHeader({ onClose }: BackgroundSelectionHeaderProps) {
  const classes = useStyles();
  const { t } = useTranslation('completeBackground');
  return (
    <div className={classes.container}>
      <div className={classes.text}>{t('title')}</div>
      <button className={classes.closeBackgroundSelection} onClick={onClose} aria-label={t('close')} type="button">
        <CloseIcon />
      </button>
    </div>
  );
}

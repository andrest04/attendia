import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { getLocale, Locale, setLocale, subscribeLocale } from '../../i18n/locale';
import { t } from '../../i18n/translate';

const useStyles = makeStyles({
  group: {
    display: 'inline-flex',
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
    border: '1px solid #d5e2f5',
  },
  button: {
    border: 'none',
    background: 'transparent',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '6px 8px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  idle: {
    color: '#64748b',
  },
  pressed: {
    background: '#e8f0fe',
    color: '#1d4ed8',
  },
});

const OPTIONS: Locale[] = ['es', 'en'];

/** ES / EN. Labels stay as language codes so the control is readable in either language. */
export default function LanguageSwitch() {
  const classes = useStyles();
  const [locale, setCurrent] = useState(getLocale);

  useEffect(() => subscribeLocale(() => setCurrent(getLocale())), []);

  return (
    <div className={classes.group} role="group" aria-label={t('Idioma')} data-testid="language-switch">
      {OPTIONS.map(option => {
        const pressed = locale === option;
        return (
          <button
            key={option}
            type="button"
            className={`${classes.button} ${pressed ? classes.pressed : classes.idle}`}
            aria-pressed={pressed}
            onClick={() => setLocale(option)}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

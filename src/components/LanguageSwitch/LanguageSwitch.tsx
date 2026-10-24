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
  },
  light: {
    border: '1px solid #d5e2f5',
  },
  dark: {
    border: '1px solid rgba(255,255,255,0.28)',
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
  lightButton: {
    color: '#64748b',
  },
  darkButton: {
    color: 'rgba(255,255,255,0.72)',
  },
  lightPressed: {
    background: '#e8f0fe',
    color: '#1d4ed8',
  },
  darkPressed: {
    background: 'rgba(255,255,255,0.16)',
    color: '#ffffff',
  },
});

const OPTIONS: Locale[] = ['es', 'en'];

/** ES / EN. Labels stay as language codes so the control is readable in either language. */
export default function LanguageSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const classes = useStyles();
  const [locale, setCurrent] = useState(getLocale);

  useEffect(() => subscribeLocale(() => setCurrent(getLocale())), []);

  return (
    <div
      className={`${classes.group} ${tone === 'dark' ? classes.dark : classes.light}`}
      role="group"
      aria-label={t('Idioma')}
      data-testid="language-switch"
    >
      {OPTIONS.map(option => {
        const pressed = locale === option;
        const toneClass = tone === 'dark' ? classes.darkButton : classes.lightButton;
        const pressedClass = tone === 'dark' ? classes.darkPressed : classes.lightPressed;
        return (
          <button
            key={option}
            type="button"
            className={`${classes.button} ${pressed ? pressedClass : toneClass}`}
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

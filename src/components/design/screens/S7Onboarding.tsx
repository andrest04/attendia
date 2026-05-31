import React, { useState } from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import VideocamIcon from '@material-ui/icons/Videocam';
import BarChartIcon from '@material-ui/icons/BarChart';
import PanToolIcon from '@material-ui/icons/PanTool';
import ChatIcon from '@material-ui/icons/Chat';
import CloseIcon from '@material-ui/icons/Close';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';

import USTag from '../USTag';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData, OnboardingIcon, OnboardingZone } from '../data';

const stepIcon: Record<OnboardingIcon, typeof VideocamIcon> = {
  camera: VideocamIcon,
  attention: BarChartIcon,
  hand: PanToolIcon,
};

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      position: 'relative',
      height: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      overflow: 'hidden',
    },

    /* Mock session background (darkened, out of palette intentionally to mimic a live session) */
    bg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: wf.darkStage,
    },
    bgTopbar: { height: 36, backgroundColor: wf.darkRail, borderBottom: `1px solid ${wf.darkBorder}` },
    bgCols: { display: 'flex', flex: 1, overflow: 'hidden' },
    bgLeft: { width: 220, backgroundColor: wf.darkPanel, borderRight: `1px solid ${wf.darkBorder}`, padding: 12 },
    bgLeftItem: {
      height: 32,
      backgroundColor: wf.darkStage,
      borderRadius: 3,
      marginBottom: 4,
      border: `1px solid ${wf.darkBorder}`,
    },
    bgCenter: { flex: 1, padding: 16 },
    bgMainVideo: {
      height: 260,
      backgroundColor: wf.darkTile,
      borderRadius: 6,
      border: `1px solid ${wf.darkBorderStrong}`,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bgRight: { width: 280, backgroundColor: wf.darkPanel, borderLeft: `1px solid ${wf.darkBorder}` },
    bgRightTabs: { height: 36, borderBottom: `1px solid ${wf.darkBorder}`, display: 'flex' },
    bgRightTabActive: { flex: 1, backgroundColor: wf.darkStage, borderBottom: `2px solid ${wf.darkBorderActive}` },
    bgRightTab: { flex: 1 },
    bgRightBody: { padding: 12 },
    bgRightItem: {
      height: 28,
      backgroundColor: wf.darkStage,
      borderRadius: 3,
      marginBottom: 6,
      border: `1px solid ${wf.darkBorder}`,
    },
    bgBottombar: {
      height: 70,
      backgroundColor: wf.darkRail,
      borderTop: `2px solid ${wf.darkBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '0 24px',
    },
    bgBottomBtn: {
      width: 44,
      height: 44,
      backgroundColor: wf.darkStage,
      borderRadius: 6,
      border: `1px solid ${wf.darkBorder}`,
    },

    /* Dim overlay */
    dim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      pointerEvents: 'none',
    },

    /* Tutorial card */
    card: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      width: 480,
      maxWidth: 'calc(100% - 32px)',
      backgroundColor: wf.white,
      borderRadius: 10,
      border: `2px solid ${wf.gray700}`,
      overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      zIndex: 10,
    },

    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      backgroundColor: wf.gray700,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    headerIcon: {
      width: 32,
      height: 32,
      backgroundColor: wf.gray500,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCount: { fontSize: 10, color: wf.gray500 },
    headerTitle: { fontSize: 14, color: wf.white, fontWeight: 600 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 },

    progress: { display: 'flex', gap: 4, padding: '16px 20px 0' },
    progressSeg: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },

    body: { display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' },
    epicTag: {
      alignSelf: 'flex-start',
      padding: '3px 8px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
      fontSize: 10,
      color: wf.gray500,
    },
    description: { fontSize: 13, color: wf.gray700, lineHeight: 1.6 },
    callout: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      padding: '10px 12px',
      backgroundColor: wf.bg,
      border: `1px dashed ${wf.gray500}`,
      borderRadius: 6,
    },
    calloutText: { fontSize: 11, color: wf.gray500 },

    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderTop: `1px solid ${wf.gray300}`,
    },
    footerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    skipBtn: {
      background: 'none',
      border: 'none',
      fontSize: 12,
      color: wf.gray500,
      cursor: 'pointer',
      textDecoration: 'underline',
      padding: 0,
    },
    footerRight: { display: 'flex', alignItems: 'center', gap: 8 },
    prevBtn: {
      padding: '8px 16px',
      border: `1px solid ${wf.gray500}`,
      borderRadius: 6,
      backgroundColor: wf.bg,
      fontSize: 13,
      color: wf.gray700,
      cursor: 'pointer',
    },
    nextBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 18px',
      border: `1px solid ${wf.gray700}`,
      borderRadius: 6,
      backgroundColor: wf.gray700,
      fontSize: 13,
      color: wf.white,
      cursor: 'pointer',
    },

    manual: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '8px 20px',
      borderTop: `1px solid ${wf.gray300}`,
      backgroundColor: '#FAFAFA',
    },
    manualLink: { fontSize: 11, color: wf.gray500, textDecoration: 'underline' },
    manualTag: { marginLeft: 4 },

    /* Completed / dismissed state */
    done: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      width: 360,
      maxWidth: 'calc(100% - 32px)',
      padding: 28,
      backgroundColor: wf.white,
      borderRadius: 10,
      border: `2px solid ${wf.gray700}`,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      textAlign: 'center',
      zIndex: 10,
    },
    doneTitle: { fontSize: 15, color: wf.ink, fontWeight: 600 },
    doneText: { fontSize: 12, color: wf.gray500 },
    doneBtn: {
      marginTop: 4,
      padding: '8px 18px',
      border: `1px solid ${wf.gray700}`,
      borderRadius: 6,
      backgroundColor: wf.gray700,
      fontSize: 13,
      color: wf.white,
      cursor: 'pointer',
    },
  })
);

/** Positions (absolute) for the spotlight that highlights the relevant session zone. */
const highlightStyle: Record<OnboardingZone, React.CSSProperties> = {
  toolbar: { bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 320, height: 64 },
  right: { top: 48, right: 8, width: 292, bottom: 80 },
  chat: { top: 48, right: 8, width: 292, height: 200 },
  analytics: { top: 48, right: 8, width: 292, bottom: 80 },
};

function MockSessionBg() {
  const classes = useStyles();
  return (
    <div className={classes.bg}>
      <div className={classes.bgTopbar} />
      <div className={classes.bgCols}>
        <div className={classes.bgLeft}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={classes.bgLeftItem} />
          ))}
        </div>
        <div className={classes.bgCenter}>
          <div className={classes.bgMainVideo}>
            <VideocamIcon style={{ fontSize: 40, color: wf.darkFgDim }} />
          </div>
        </div>
        <div className={classes.bgRight}>
          <div className={classes.bgRightTabs}>
            <div className={classes.bgRightTabActive} />
            <div className={classes.bgRightTab} />
          </div>
          <div className={classes.bgRightBody}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={classes.bgRightItem} />
            ))}
          </div>
        </div>
      </div>
      <div className={classes.bgBottombar}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={classes.bgBottomBtn} />
        ))}
      </div>
    </div>
  );
}

/** S7 — Guided onboarding tour over a mock session. Design mock (US21, US32, US34). */
export default function S7Onboarding() {
  const classes = useStyles();
  const { onboarding } = mockData;
  const { steps, epic } = onboarding;
  const [currentStep, setCurrentStep] = useState(0);

  const dismissed = currentStep >= steps.length;

  if (dismissed) {
    return (
      <div className={classes.root}>
        <MockSessionBg />
        <div className={classes.dim} />
        <div className={classes.done}>
          <Typography className={classes.doneTitle}>Tutorial finalizado</Typography>
          <Typography className={classes.doneText}>
            Puedes volver a verlo cuando quieras desde el manual completo.
          </Typography>
          <button type="button" className={classes.doneBtn} onClick={() => setCurrentStep(0)}>
            Reiniciar tutorial
          </button>
          <USTag ids={['US34']} />
        </div>
      </div>
    );
  }

  const step = steps[currentStep];
  const StepIcon = stepIcon[step.icon];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className={classes.root}>
      {/* Mock session background */}
      <MockSessionBg />

      {/* Highlight zone */}
      <div
        style={{
          position: 'absolute',
          border: `3px solid ${wf.white}`,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.08)',
          ...highlightStyle[step.zone],
        }}
      />

      {/* Dim overlay */}
      <div className={classes.dim} />

      {/* Tutorial card */}
      <div className={classes.card}>
        {/* Header */}
        <div className={classes.header}>
          <div className={classes.headerLeft}>
            <div className={classes.headerIcon}>
              <StepIcon style={{ fontSize: 16, color: wf.white }} />
            </div>
            <div>
              <span className={classes.stepCount}>
                Paso {currentStep + 1} de {steps.length}
              </span>
              <Typography className={classes.headerTitle}>{step.title}</Typography>
            </div>
          </div>
          <button
            type="button"
            className={classes.closeBtn}
            onClick={() => setCurrentStep(steps.length)}
            aria-label="Cerrar tutorial"
          >
            <CloseIcon style={{ fontSize: 18, color: wf.gray500 }} />
          </button>
        </div>

        {/* Step progress */}
        <div className={classes.progress}>
          {steps.map((_, i) => (
            <div
              key={i}
              className={classes.progressSeg}
              style={{ backgroundColor: i <= currentStep ? wf.gray700 : wf.gray300 }}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>

        {/* Body */}
        <div className={classes.body}>
          <span className={classes.epicTag}>
            {epic} · {step.us.join(', ')}
          </span>

          <Typography className={classes.description}>{step.description}</Typography>

          <div className={classes.callout}>
            <ChatIcon style={{ fontSize: 13, color: wf.gray500, marginTop: 2 }} />
            <Typography className={classes.calloutText}>{step.callout}</Typography>
          </div>

          <USTag ids={step.us} />
        </div>

        {/* Footer */}
        <div className={classes.footer}>
          <div className={classes.footerLeft}>
            <button type="button" className={classes.skipBtn} onClick={() => setCurrentStep(steps.length)}>
              Saltar tutorial
            </button>
            <USTag ids={['US34']} />
          </div>

          <div className={classes.footerRight}>
            {currentStep > 0 && (
              <button type="button" className={classes.prevBtn} onClick={() => setCurrentStep(currentStep - 1)}>
                Anterior
              </button>
            )}
            <button
              type="button"
              className={classes.nextBtn}
              onClick={() => (isLast ? setCurrentStep(0) : setCurrentStep(currentStep + 1))}
            >
              {isLast ? 'Reiniciar' : 'Siguiente'}
              <ArrowForwardIcon style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>

        {/* Manual link */}
        <div className={classes.manual}>
          <MenuBookIcon style={{ fontSize: 11, color: wf.gray500 }} />
          <span className={classes.manualLink}>Acceder al manual completo</span>
          <USTag ids={['US34']} className={classes.manualTag} />
        </div>
      </div>
    </div>
  );
}

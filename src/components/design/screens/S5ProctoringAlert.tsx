import React, { useState } from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import ReportIcon from '@material-ui/icons/Report';
import CloseIcon from '@material-ui/icons/Close';
import VideocamIcon from '@material-ui/icons/Videocam';
import TuneIcon from '@material-ui/icons/Tune';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningIcon from '@material-ui/icons/Warning';

import USTag from '../USTag';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData } from '../data';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      position: 'relative',
      height: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      overflow: 'hidden',
    },

    /* Blurred background session */
    background: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      backgroundColor: wf.darkStage,
      filter: 'blur(2px)',
    },
    bgRail: { width: 220, backgroundColor: wf.darkRail, borderRight: `1px solid ${wf.darkBorder}` },
    bgRailRight: { width: 280, backgroundColor: wf.darkRail, borderLeft: `1px solid ${wf.darkBorder}` },
    bgCenter: { flex: 1, padding: 16 },
    bgGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
    bgTile: {
      height: 90,
      backgroundColor: wf.darkTile,
      borderRadius: 4,
      border: `1px solid ${wf.darkBorderStrong}`,
    },

    /* Overlay + modal */
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modal: {
      width: 520,
      backgroundColor: wf.white,
      borderRadius: 10,
      border: `2px solid ${wf.gray700}`,
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    },

    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      backgroundColor: wf.gray700,
    },
    headerTitleGroup: { display: 'flex', alignItems: 'center', gap: 8 },
    headerTitle: { color: wf.white, fontSize: 15, fontWeight: 600, margin: 0 },
    closeBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 4,
      display: 'flex',
      alignItems: 'center',
    },

    modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 20 },

    epicLabel: {
      padding: '3px 8px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
      display: 'inline-block',
      alignSelf: 'flex-start',
    },
    epicText: { fontSize: 10, color: wf.gray500 },

    studentBlock: { display: 'flex', gap: 16, alignItems: 'flex-start' },
    thumbnail: {
      position: 'relative',
      width: 140,
      height: 105,
      backgroundColor: wf.gray300,
      borderRadius: 6,
      border: `1px solid ${wf.gray500}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flexShrink: 0,
    },
    thumbName: { fontSize: 10, color: wf.gray500 },
    faceBoxPrimary: {
      position: 'absolute',
      top: 14,
      left: 22,
      width: 34,
      height: 34,
      border: `2px dashed ${wf.gray700}`,
      borderRadius: 2,
    },
    faceBoxSecondary: {
      position: 'absolute',
      top: 14,
      right: 22,
      width: 28,
      height: 28,
      border: `2px dashed ${wf.gray500}`,
      borderRadius: 2,
    },

    details: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
    detailName: { fontSize: 14, color: wf.ink, fontWeight: 600, margin: 0 },
    detailStatus: { fontSize: 12, color: wf.gray500, margin: '2px 0 0 0' },
    alertBox: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 4,
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray300}`,
    },
    alertHeadline: { fontSize: 13, color: wf.gray700, margin: 0, fontWeight: 500 },
    alertMeta: { fontSize: 11, color: wf.gray500, margin: '4px 0 0 0' },

    sep: { height: 1, backgroundColor: wf.gray300 },

    /* Sensitivity slider */
    sliderBlock: { display: 'flex', flexDirection: 'column', gap: 8 },
    sliderHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    sliderLabelGroup: { display: 'flex', alignItems: 'center', gap: 8 },
    sliderLabel: { fontSize: 13, color: wf.gray700, fontWeight: 500 },
    sliderValue: { fontSize: 13, color: wf.gray700, fontWeight: 600 },
    sliderTrack: { position: 'relative', height: 8 },
    sliderTrackBase: { height: '100%', backgroundColor: wf.gray300, borderRadius: 4 },
    sliderTrackFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      backgroundColor: wf.gray700,
      borderRadius: 4,
    },
    sliderInput: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: 0,
      cursor: 'pointer',
      margin: 0,
    },
    sliderScale: { display: 'flex', justifyContent: 'space-between' },
    sliderScaleText: { fontSize: 10, color: wf.gray500 },

    /* Actions */
    actions: { display: 'flex', gap: 12 },
    actionBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '11px 16px',
      borderRadius: 6,
      fontSize: 13,
      cursor: 'pointer',
    },
    actionSecondary: {
      border: `1px solid ${wf.gray500}`,
      backgroundColor: wf.bg,
      color: wf.gray700,
    },
    actionPrimary: {
      border: `1px solid ${wf.gray700}`,
      backgroundColor: wf.gray700,
      color: wf.white,
    },
  })
);

/** Blurred professor-session backdrop the alert modal floats over. Decorative only. */
function BackgroundSession() {
  const classes = useStyles();
  return (
    <div className={classes.background}>
      <div className={classes.bgRail} />
      <div className={classes.bgCenter}>
        <div className={classes.bgGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={classes.bgTile} />
          ))}
        </div>
      </div>
      <div className={classes.bgRailRight} />
    </div>
  );
}

/** S5 — Proctoring alert modal: multi-face detection, sensitivity threshold, resolution actions. Design mock. */
export default function S5ProctoringAlert() {
  const classes = useStyles();
  const { proctoringAlert } = mockData;

  const [sensitivity, setSensitivity] = useState(proctoringAlert.defaultSensitivity);

  return (
    <div className={classes.root}>
      {/* Blurred background */}
      <BackgroundSession />

      {/* Overlay */}
      <div className={classes.overlay}>
        {/* Modal */}
        <div className={classes.modal}>
          {/* Modal header */}
          <div className={classes.modalHeader}>
            <div className={classes.headerTitleGroup}>
              <ReportIcon style={{ fontSize: 18, color: wf.white }} />
              <Typography component="h3" className={classes.headerTitle}>
                Detección múltiple de rostros
              </Typography>
            </div>
            <button type="button" className={classes.closeBtn}>
              <CloseIcon style={{ fontSize: 18, color: wf.white }} />
            </button>
          </div>

          {/* Modal body */}
          <div className={classes.modalBody}>
            {/* Epic label */}
            <div className={classes.epicLabel}>
              <span className={classes.epicText}>{proctoringAlert.epic}</span>
            </div>

            {/* Student info + thumbnail */}
            <div className={classes.studentBlock}>
              {/* Video thumbnail */}
              <div className={classes.thumbnail}>
                <VideocamIcon style={{ fontSize: 28, color: wf.gray500 }} />
                <span className={classes.thumbName}>{proctoringAlert.studentName}</span>
                {/* Face detection boxes */}
                <div className={classes.faceBoxPrimary} />
                <div className={classes.faceBoxSecondary} />
              </div>

              {/* Alert details */}
              <div className={classes.details}>
                <div>
                  <p className={classes.detailName}>{proctoringAlert.studentName}</p>
                  <p className={classes.detailStatus}>{proctoringAlert.studentStatus}</p>
                </div>

                <div className={classes.alertBox}>
                  <WarningIcon style={{ fontSize: 15, color: wf.gray700, marginTop: 1 }} />
                  <div>
                    <p className={classes.alertHeadline}>
                      Se detectaron {proctoringAlert.faceCount} rostros en la cámara de {proctoringAlert.studentName}
                    </p>
                    <p className={classes.alertMeta}>
                      Detectado a las {proctoringAlert.detectedAt} — Confianza: {proctoringAlert.confidence}%
                    </p>
                  </div>
                </div>
                <USTag ids={['US29', 'US31']} />
              </div>
            </div>

            <div className={classes.sep} />

            {/* Sensitivity slider */}
            <div className={classes.sliderBlock}>
              <div className={classes.sliderHead}>
                <div className={classes.sliderLabelGroup}>
                  <TuneIcon style={{ fontSize: 14, color: wf.gray700 }} />
                  <span className={classes.sliderLabel}>Umbral de sensibilidad de proctoring</span>
                </div>
                <span className={classes.sliderValue}>{sensitivity}%</span>
              </div>
              <div className={classes.sliderTrack}>
                <div className={classes.sliderTrackBase} />
                <div className={classes.sliderTrackFill} style={{ width: `${sensitivity}%` }} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sensitivity}
                  onChange={e => setSensitivity(Number(e.target.value))}
                  className={classes.sliderInput}
                />
              </div>
              <div className={classes.sliderScale}>
                <span className={classes.sliderScaleText}>Permisivo</span>
                <span className={classes.sliderScaleText}>Estricto</span>
              </div>
              <USTag ids={['US30']} />
            </div>

            <div className={classes.sep} />

            {/* Actions */}
            <div className={classes.actions}>
              <button type="button" className={`${classes.actionBtn} ${classes.actionSecondary}`}>
                <CheckCircleIcon style={{ fontSize: 15 }} />
                Marcar como legítimo
              </button>
              <button type="button" className={`${classes.actionBtn} ${classes.actionPrimary}`}>
                <WarningIcon style={{ fontSize: 15 }} />
                Enviar advertencia al estudiante
              </button>
            </div>
            <USTag ids={['US29', 'US31']} />
          </div>
        </div>
      </div>
    </div>
  );
}

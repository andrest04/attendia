import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import SecurityIcon from '@material-ui/icons/Security';
import LockIcon from '@material-ui/icons/Lock';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import VisibilityIcon from '@material-ui/icons/Visibility';
import StorageIcon from '@material-ui/icons/Storage';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

import USTag from '../USTag';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData, SecurityIconKind } from '../data';

const sectionIcon: Record<SecurityIconKind, typeof LockIcon> = {
  lock: LockIcon,
  key: VpnKeyIcon,
  eye: VisibilityIcon,
  server: StorageIcon,
};

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      minHeight: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      overflowY: 'auto',
    },
    page: { maxWidth: 900, margin: '0 auto', padding: '28px 32px' },

    /* Header */
    header: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 24,
      gap: 16,
    },
    headerInfo: { display: 'flex', flexDirection: 'column', gap: 8 },
    titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
    title: { color: wf.ink, fontSize: 18, fontWeight: 600 },
    subtitle: { fontSize: 12, color: wf.gray500 },
    headerActions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
    epicBadge: {
      padding: '4px 10px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
    },
    epicText: { fontSize: 10, color: wf.gray500 },
    pdfBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      border: `1px solid ${wf.gray500}`,
      borderRadius: 5,
      backgroundColor: wf.white,
      fontSize: 11,
      color: wf.gray500,
      cursor: 'pointer',
    },

    /* Sections list */
    sections: { display: 'flex', flexDirection: 'column', gap: 16 },
    section: {
      backgroundColor: wf.white,
      border: `1px solid ${wf.gray300}`,
      borderLeft: `4px solid ${wf.gray700}`,
      borderRadius: 8,
      padding: '24px 28px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
    },
    sectionIcon: {
      width: 44,
      height: 44,
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sectionContent: { flex: 1 },
    sectionTitleRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
    badge: {
      padding: '3px 10px',
      backgroundColor: wf.gray700,
      borderRadius: 3,
    },
    badgeText: { fontSize: 11, color: wf.white, fontWeight: 600, letterSpacing: '0.05em' },
    sectionTitle: { color: wf.ink, fontSize: 15, fontWeight: 600 },
    sectionSubtitle: { fontSize: 12, color: wf.gray500, fontStyle: 'italic', marginBottom: 8 },
    sectionDescription: { fontSize: 13, color: wf.gray700, lineHeight: 1.6, marginBottom: 10 },
    bullets: { margin: 0, padding: '0 0 0 16px' },
    bullet: { fontSize: 12, color: wf.gray500, marginBottom: 4, listStyleType: 'disc' },
    sectionFooter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    statusRow: { display: 'flex', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 11, color: wf.gray700, fontWeight: 500 },
    footerTags: { display: 'flex', alignItems: 'center', gap: 8 },
    epicTag: {
      fontSize: 9,
      color: wf.gray500,
      border: `1px solid ${wf.gray300}`,
      padding: '1px 6px',
      borderRadius: 2,
    },

    /* Footer note */
    note: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 24,
      padding: 16,
      backgroundColor: wf.white,
      border: `1px dashed ${wf.gray500}`,
      borderRadius: 6,
    },
    noteText: { fontSize: 11, color: wf.gray500 },
  })
);

/** S8 — Security & privacy panel. Design mock (EP08 · US35–US38). */
export default function S8Security() {
  const classes = useStyles();
  const { security } = mockData;

  return (
    <div className={classes.root}>
      <div className={classes.page}>
        {/* Header */}
        <div className={classes.header}>
          <div className={classes.headerInfo}>
            <div className={classes.titleRow}>
              <SecurityIcon style={{ fontSize: 22, color: wf.gray700 }} />
              <Typography className={classes.title}>{security.title}</Typography>
            </div>
            <Typography className={classes.subtitle}>{security.subtitle}</Typography>
          </div>
          <div className={classes.headerActions}>
            <div className={classes.epicBadge}>
              <span className={classes.epicText}>{security.epicLabel}</span>
            </div>
            <button type="button" className={classes.pdfBtn}>
              <OpenInNewIcon style={{ fontSize: 11 }} />
              Exportar como PDF
            </button>
          </div>
        </div>

        {/* Security sections */}
        <div className={classes.sections}>
          {security.sections.map(section => {
            const Icon = sectionIcon[section.icon];
            return (
              <div key={section.id} className={classes.section}>
                <div className={classes.sectionIcon}>
                  <Icon style={{ fontSize: 22, color: wf.gray700 }} />
                </div>

                <div className={classes.sectionContent}>
                  <div className={classes.sectionTitleRow}>
                    <div className={classes.badge}>
                      <span className={classes.badgeText}>{section.badge}</span>
                    </div>
                    <Typography className={classes.sectionTitle}>{section.title}</Typography>
                  </div>

                  <Typography className={classes.sectionSubtitle}>{section.subtitle}</Typography>

                  <Typography className={classes.sectionDescription}>{section.description}</Typography>

                  <ul className={classes.bullets}>
                    {section.bullets.map(bullet => (
                      <li key={bullet} className={classes.bullet}>
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className={classes.sectionFooter}>
                    <div className={classes.statusRow}>
                      <CheckCircleIcon style={{ fontSize: 13, color: wf.gray700 }} />
                      <span className={classes.statusText}>Implementado</span>
                    </div>
                    <div className={classes.footerTags}>
                      <span className={classes.epicTag}>{section.epic}</span>
                      <USTag ids={section.us} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className={classes.note}>
          <SecurityIcon style={{ fontSize: 15, color: wf.gray500 }} />
          <Typography className={classes.noteText}>{security.footerNote}</Typography>
        </div>
      </div>
    </div>
  );
}

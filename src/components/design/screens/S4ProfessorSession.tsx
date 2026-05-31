import React, { useState } from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MicIcon from '@material-ui/icons/Mic';
import VideocamIcon from '@material-ui/icons/Videocam';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import SettingsIcon from '@material-ui/icons/Settings';
import CallEndIcon from '@material-ui/icons/CallEnd';
import PanToolIcon from '@material-ui/icons/PanTool';
import WarningIcon from '@material-ui/icons/Warning';
import PersonIcon from '@material-ui/icons/Person';
import GetAppIcon from '@material-ui/icons/GetApp';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';

import USTag from '../USTag';
import VideoTile from '../shared/VideoTile';
import ToolbarButton from '../shared/ToolbarButton';
import AttentionGauge from '../shared/AttentionGauge';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData, AttentionLevel } from '../data';

const attentionFill: Record<AttentionLevel, string> = {
  high: wf.gray700,
  medium: wf.gray500,
  low: wf.gray300,
};

const attentionShort: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Med.',
  low: 'Bajo',
};

const attentionPct: Record<AttentionLevel, number> = {
  high: 85,
  medium: 60,
  low: 35,
};

const attentionOrder: Record<AttentionLevel, number> = { high: 0, medium: 1, low: 2 };

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      height: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      display: 'flex',
      flexDirection: 'column',
    },

    /* Top status bar */
    statusBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 16px',
      flexShrink: 0,
      backgroundColor: wf.gray700,
      borderBottom: `1px solid ${wf.ink}`,
    },
    recBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px',
      backgroundColor: wf.gray500,
      borderRadius: 4,
    },
    recText: { fontSize: 10, color: wf.white, fontWeight: 600 },
    statusInfo: { fontSize: 11, color: wf.gray500 },
    statusTwilio: { fontSize: 9, color: wf.darkFgMuted, fontStyle: 'italic', marginLeft: 'auto' },

    layout: { display: 'flex', flex: 1, overflow: 'hidden' },

    /* LEFT: participants + hands */
    left: {
      width: 230,
      flexShrink: 0,
      backgroundColor: wf.white,
      borderRight: `1px solid ${wf.gray300}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    },
    leftHead: { padding: '8px 12px', borderBottom: `1px solid ${wf.gray300}` },
    leftTitle: { color: wf.ink, fontSize: 13, fontWeight: 600 },
    handsBlock: {
      padding: '8px 12px',
      borderBottom: `1px solid ${wf.gray300}`,
      backgroundColor: '#FAFAFA',
    },
    handsTitle: { fontSize: 11, color: wf.gray700, fontWeight: 600 },
    handsList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
    handRow: { display: 'flex', alignItems: 'center', gap: 8 },
    handName: { fontSize: 11, color: wf.gray700, flex: 1 },
    giveTurnBtn: {
      fontSize: 9,
      padding: '2px 6px',
      backgroundColor: wf.gray700,
      color: wf.white,
      border: 'none',
      borderRadius: 3,
      cursor: 'pointer',
    },

    participants: { flex: 1, overflowY: 'auto' },
    participant: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderBottom: `1px solid ${wf.bg}`,
    },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: '50%',
      backgroundColor: wf.gray300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    participantName: {
      fontSize: 11,
      color: wf.gray700,
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    attentionBadge: { fontSize: 8, padding: '1px 4px', borderRadius: 2, flexShrink: 0 },
    listUs: { padding: '4px 12px' },

    /* CENTER: gallery grid + toolbar */
    center: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    gallery: { flex: 1, overflowY: 'auto', padding: 12, backgroundColor: wf.darkStage },
    galleryAlert: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      padding: '8px 12px',
      borderRadius: 4,
      backgroundColor: wf.darkTile,
      border: `1px solid ${wf.darkBorderActive}`,
    },
    galleryAlertText: { fontSize: 11, color: wf.darkFgMuted },
    galleryAlertUs: { marginLeft: 'auto' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
    tileCell: { display: 'flex', flexDirection: 'column' },
    galleryFooter: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
    galleryFooterText: { fontSize: 10, color: wf.darkFgFaint },

    toolbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '12px 24px',
      flexShrink: 0,
      backgroundColor: wf.white,
      borderTop: `2px solid ${wf.gray300}`,
    },
    divider: { width: 1, height: 32, backgroundColor: wf.gray300, margin: '0 8px' },

    /* RIGHT: analytics */
    right: {
      width: 300,
      flexShrink: 0,
      backgroundColor: wf.white,
      borderLeft: `1px solid ${wf.gray300}`,
      display: 'flex',
      flexDirection: 'column',
    },
    tabs: { display: 'flex', borderBottom: `1px solid ${wf.gray300}` },
    tab: {
      flex: 1,
      padding: '10px 0',
      fontSize: 12,
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '2px solid transparent',
      cursor: 'pointer',
      marginBottom: -1,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    },
    tabActive: { fontWeight: 600, color: wf.ink, borderBottom: `2px solid ${wf.gray700}` },
    tabInactive: { fontWeight: 400, color: wf.gray500 },

    pane: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 },
    gaugeRow: { display: 'flex', justifyContent: 'center' },
    usCenter: { justifyContent: 'center' },
    thresholdAlert: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 4,
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray500}`,
    },
    thresholdText: { fontSize: 11, color: wf.gray700 },
    sep: { height: 1, backgroundColor: wf.gray300 },

    chartHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    chartTitle: { fontSize: 12, color: wf.gray700, fontWeight: 500 },
    chartBox: { height: 130 },

    exportBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      padding: 10,
      border: `1px solid ${wf.gray500}`,
      borderRadius: 6,
      backgroundColor: wf.bg,
      fontSize: 12,
      color: wf.gray700,
      cursor: 'pointer',
    },

    individualHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    individualTitle: { fontSize: 12, color: wf.gray700, fontWeight: 500 },
    sortBtn: {
      fontSize: 10,
      color: wf.gray500,
      background: 'none',
      border: `1px solid ${wf.gray300}`,
      borderRadius: 3,
      padding: '2px 6px',
      cursor: 'pointer',
    },
    individualList: { display: 'flex', flexDirection: 'column', gap: 8 },
    individualRow: { display: 'flex', flexDirection: 'column', gap: 4 },
    individualRowHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    individualName: { fontSize: 11, color: wf.gray700 },
    individualPct: { fontSize: 10, color: wf.gray500 },
    progressTrack: { height: 6, backgroundColor: wf.gray300, borderRadius: 3 },
    progressFill: { height: '100%', borderRadius: 3 },
  })
);

/** S4 — Professor in-session view: gallery grid, hands queue, group/individual attention analytics. Design mock. */
export default function S4ProfessorSession() {
  const classes = useStyles();
  const { session, students, attentionTimeline, professorSession } = mockData;

  const [activeTab, setActiveTab] = useState<'grupo' | 'individual'>('grupo');
  const [recording, setRecording] = useState(session.recording);

  const handsRaised = students.filter(s => s.handRaised);

  return (
    <div className={classes.root}>
      {/* Top status bar */}
      <div className={classes.statusBar}>
        {recording && (
          <div className={classes.recBadge}>
            <FiberManualRecordIcon style={{ fontSize: 8, color: wf.white }} />
            <span className={classes.recText}>REC</span>
            <USTag ids={['US12']} />
          </div>
        )}
        <span className={classes.statusInfo}>
          {session.courseName} · {session.studentCount} estudiantes · {session.elapsed}
        </span>
        <span className={classes.statusTwilio}>Twilio Video · WebRTC SFU</span>
      </div>

      <div className={classes.layout}>
        {/* LEFT: participants + hands */}
        <div className={classes.left}>
          <div className={classes.leftHead}>
            <Typography className={classes.leftTitle}>Participantes</Typography>
          </div>

          {/* Hands raised queue (US15) */}
          {handsRaised.length > 0 && (
            <div className={classes.handsBlock}>
              <span className={classes.handsTitle}>Manos levantadas ({handsRaised.length})</span>
              <div className={classes.handsList}>
                {handsRaised.map(s => (
                  <div key={s.id} className={classes.handRow}>
                    <PanToolIcon style={{ fontSize: 11, color: wf.gray700 }} />
                    <span className={classes.handName}>{s.name}</span>
                    <button type="button" className={classes.giveTurnBtn}>
                      Dar turno
                    </button>
                  </div>
                ))}
              </div>
              <USTag ids={['US15']} />
            </div>
          )}

          {/* Participant list with attention badges */}
          <div className={classes.participants}>
            {students.map(s => (
              <div key={s.id} className={classes.participant}>
                <div className={classes.avatar}>
                  <PersonIcon style={{ fontSize: 13, color: wf.gray500 }} />
                </div>
                <span className={classes.participantName}>{s.name}</span>
                {s.handRaised && <PanToolIcon style={{ fontSize: 10, color: wf.gray700 }} />}
                {s.multiface && <WarningIcon style={{ fontSize: 10, color: wf.gray700 }} />}
                <span
                  className={classes.attentionBadge}
                  style={{
                    backgroundColor: attentionFill[s.attention],
                    color: s.attention === 'low' ? wf.gray700 : wf.white,
                  }}
                >
                  {attentionShort[s.attention]}
                </span>
              </div>
            ))}
            <USTag ids={['US04', 'US25']} className={classes.listUs} />
          </div>
        </div>

        {/* CENTER: gallery grid + toolbar */}
        <div className={classes.center}>
          <div className={classes.gallery}>
            {/* Group attention alert (US28) */}
            {professorSession.belowThreshold && (
              <div className={classes.galleryAlert}>
                <WarningIcon style={{ fontSize: 13, color: wf.darkFgMuted }} />
                <span className={classes.galleryAlertText}>
                  Atención grupal por debajo del umbral ({professorSession.attentionThreshold}%)
                </span>
                <USTag ids={['US28']} className={classes.galleryAlertUs} />
              </div>
            )}

            {/* Student tile grid */}
            <div className={classes.grid}>
              {students.map(s => (
                <div key={s.id} className={classes.tileCell}>
                  <VideoTile
                    name={s.name}
                    height={100}
                    attentionLevel={s.attention}
                    showProctoringAlert={s.multiface}
                    showTwilio
                    connectionQuality="strong"
                  />
                  <USTag ids={['US08', 'US25']} />
                </div>
              ))}

              {/* Screen share tile */}
              <div className={classes.tileCell}>
                <VideoTile name="Pantalla compartida" height={100} isScreenShare showTwilio />
                <USTag ids={['US09']} />
              </div>
            </div>

            <div className={classes.galleryFooter}>
              <span className={classes.galleryFooterText}>
                Mostrando {professorSession.visibleStudents} / {professorSession.totalStudents} estudiantes
              </span>
              <USTag ids={['US08']} />
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className={classes.toolbar}>
            <ToolbarButton icon={MicIcon} label="Silenciar" active usId="US07" />
            <ToolbarButton icon={VideocamIcon} label="Cámara" active usId="US07" />
            <ToolbarButton icon={ScreenShareIcon} label="Compartir" active usId="US09" />
            <ToolbarButton
              icon={FiberManualRecordIcon}
              label={recording ? 'Detener REC' : 'Grabar'}
              variant={recording ? 'active' : 'default'}
              onClick={() => setRecording(v => !v)}
              usId="US12"
            />
            <ToolbarButton icon={SettingsIcon} label="Proctoring" active usId="US30" />
            <div className={classes.divider} />
            <ToolbarButton icon={CallEndIcon} label="Terminar sesión" variant="danger" usId="US05" />
          </div>
        </div>

        {/* RIGHT: analytics */}
        <div className={classes.right}>
          <div className={classes.tabs}>
            {(['grupo', 'individual'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${classes.tab} ${activeTab === tab ? classes.tabActive : classes.tabInactive}`}
              >
                {tab === 'grupo' ? 'Grupo' : 'Individual'}
              </button>
            ))}
          </div>

          {activeTab === 'grupo' ? (
            <div className={classes.pane}>
              {/* Group gauge (US24) */}
              <div className={classes.gaugeRow}>
                <AttentionGauge value={professorSession.groupAttention} size={120} label="Atención grupal" />
              </div>
              <USTag ids={['US24']} className={classes.usCenter} />

              {/* Threshold alert (US28) */}
              {professorSession.belowThreshold && (
                <div className={classes.thresholdAlert}>
                  <WarningIcon style={{ fontSize: 13, color: wf.gray700 }} />
                  <span className={classes.thresholdText}>Atención grupal por debajo del umbral</span>
                </div>
              )}
              <USTag ids={['US28']} />

              <div className={classes.sep} />

              {/* Timeline chart (US26) */}
              <div>
                <div className={classes.chartHead}>
                  <span className={classes.chartTitle}>Evolución temporal</span>
                  <TrendingUpIcon style={{ fontSize: 14, color: wf.gray500 }} />
                </div>
                <div className={classes.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attentionTimeline} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="s4AttentionFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={wf.gray500} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={wf.gray500} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: wf.gray500 }}
                        axisLine={{ stroke: wf.gray300 }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: wf.gray500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 10, backgroundColor: wf.white, border: `1px solid ${wf.gray300}` }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={wf.gray700}
                        strokeWidth={1.5}
                        fill="url(#s4AttentionFill)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <USTag ids={['US26']} />
              </div>

              {/* Export report (US27) */}
              <button type="button" className={classes.exportBtn}>
                <GetAppIcon style={{ fontSize: 14 }} />
                Exportar reporte
              </button>
              <USTag ids={['US27']} />
            </div>
          ) : (
            <div className={classes.pane}>
              <div className={classes.individualHead}>
                <span className={classes.individualTitle}>Atención individual</span>
                <button type="button" className={classes.sortBtn}>
                  Ordenar ↓
                </button>
              </div>
              <div className={classes.individualList}>
                {[...students]
                  .sort((a, b) => attentionOrder[a.attention] - attentionOrder[b.attention])
                  .map(s => {
                    const pct = attentionPct[s.attention];
                    return (
                      <div key={s.id} className={classes.individualRow}>
                        <div className={classes.individualRowHead}>
                          <span className={classes.individualName}>{s.name}</span>
                          <span className={classes.individualPct}>{pct}</span>
                        </div>
                        <div className={classes.progressTrack}>
                          <div
                            className={classes.progressFill}
                            style={{ width: `${pct}%`, backgroundColor: attentionFill[s.attention] }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <USTag ids={['US25']} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

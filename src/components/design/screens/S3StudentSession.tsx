import React, { useState } from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import PanToolIcon from '@material-ui/icons/PanTool';
import ChatIcon from '@material-ui/icons/Chat';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import WarningIcon from '@material-ui/icons/Warning';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import PersonIcon from '@material-ui/icons/Person';
import NotificationsIcon from '@material-ui/icons/Notifications';

import USTag from '../USTag';
import ToolbarButton from '../shared/ToolbarButton';
import AttentionGauge from '../shared/AttentionGauge';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData, StudentSelf } from '../data';

const notifIcon = { hand: PanToolIcon, join: NotificationsIcon } as const;

const captureLabel: Record<StudentSelf['capture'], string> = {
  active: 'Activa',
  inactive: 'Inactiva',
};

const headOrientation: Record<StudentSelf['headOrientation'], string> = {
  front: '↑ Mirando al frente · Normal',
  away: '↗ Mirada fuera de la pantalla',
};

const postureMap: Record<StudentSelf['posture'], { pct: number; label: string }> = {
  good: { pct: 85, label: 'Buena' },
  neutral: { pct: 60, label: 'Normal' },
  bad: { pct: 35, label: 'Encorvada' },
};

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      height: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      display: 'flex',
      flexDirection: 'column',
    },

    /* Degradation banner */
    banner: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      flexShrink: 0,
      backgroundColor: wf.gray300,
      borderBottom: `1px solid ${wf.gray500}`,
    },
    bannerText: { fontSize: 12, color: wf.gray700 },
    bannerClose: {
      marginLeft: 'auto',
      fontSize: 11,
      color: wf.gray500,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
    },

    layout: { display: 'flex', flex: 1, overflow: 'hidden' },

    /* LEFT: participants */
    left: {
      width: 220,
      flexShrink: 0,
      backgroundColor: wf.white,
      borderRight: `1px solid ${wf.gray300}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    },
    leftHead: {
      padding: '12px',
      borderBottom: `1px solid ${wf.gray300}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leftTitle: { color: wf.ink, fontSize: 13, fontWeight: 600 },
    countBadge: {
      fontSize: 10,
      color: wf.white,
      backgroundColor: wf.gray700,
      padding: '1px 6px',
      borderRadius: 10,
    },
    participants: { flex: 1, overflowY: 'auto' },
    participant: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      borderBottom: `1px solid ${wf.bg}`,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    participantName: {
      fontSize: 12,
      color: wf.gray700,
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    participantRole: { fontSize: 9, color: wf.gray500 },

    notifs: {
      padding: '12px',
      borderTop: `1px solid ${wf.gray300}`,
      backgroundColor: '#FAFAFA',
    },
    notifsTitle: { fontSize: 11, color: wf.gray500, fontWeight: 500 },
    notif: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px',
      marginTop: 8,
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 4,
    },
    notifText: { fontSize: 10, color: wf.gray700 },

    /* CENTER: main video */
    center: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    stage: { flex: 1, position: 'relative', padding: 16, backgroundColor: wf.darkStage },
    mainTile: {
      width: '100%',
      height: '100%',
      backgroundColor: wf.darkTile,
      borderRadius: 8,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    speakerName: { fontSize: 14, color: wf.gray500 },
    twilioBadge: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      padding: '2px 8px',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 3,
      border: `1px solid ${wf.darkBorderActive}`,
      fontSize: 9,
      color: wf.darkFgMuted,
      fontStyle: 'italic',
    },
    stageUs: { position: 'absolute', bottom: 8, right: 8 },
    quality: {
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: '2px 6px',
      borderRadius: 3,
    },
    qualityBars: { display: 'flex', alignItems: 'flex-end', gap: 2 },
    qualityLabel: { fontSize: 9, color: wf.darkFgMuted },
    pip: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 140,
      height: 90,
      backgroundColor: wf.gray300,
      borderRadius: 6,
      border: `2px solid ${wf.gray500}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    pipText: { fontSize: 10, color: wf.gray500 },

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

    /* RIGHT: chat / mi atención */
    right: {
      width: 280,
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
    },
    tabActive: { fontWeight: 600, color: wf.ink, borderBottom: `2px solid ${wf.gray700}` },
    tabInactive: { fontWeight: 400, color: wf.gray500 },

    chatPane: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
    messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 },
    msgHead: { display: 'flex', alignItems: 'baseline', gap: 8 },
    msgAuthor: { fontSize: 11, color: wf.gray700, fontWeight: 600 },
    msgTime: { fontSize: 10, color: wf.gray500 },
    msgBubble: {
      padding: '8px 10px',
      backgroundColor: wf.bg,
      borderRadius: 6,
      border: `1px solid ${wf.gray300}`,
      fontSize: 12,
      color: wf.gray700,
      marginTop: 2,
    },
    inputRow: { padding: 12, display: 'flex', gap: 8, borderTop: `1px solid ${wf.gray300}` },
    input: {
      flex: 1,
      padding: '8px 10px',
      border: `1px solid ${wf.gray500}`,
      borderRadius: 4,
      fontSize: 12,
      backgroundColor: wf.white,
      outline: 'none',
    },
    sendBtn: {
      padding: '8px 12px',
      backgroundColor: wf.gray700,
      color: wf.white,
      border: 'none',
      borderRadius: 4,
      fontSize: 12,
      cursor: 'pointer',
      flexShrink: 0,
    },

    attentionPane: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 },
    sep: { height: 1, backgroundColor: wf.gray300 },
    metricGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
    metricRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    metricLabel: { fontSize: 12, color: wf.gray700 },
    metricValue: { fontSize: 11, color: wf.gray700 },
    chip: {
      fontSize: 10,
      color: wf.gray700,
      backgroundColor: wf.gray300,
      padding: '2px 6px',
      borderRadius: 10,
    },
    metricNote: {
      padding: '6px 8px',
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 4,
      fontSize: 11,
      color: wf.gray500,
    },
    progressTrack: { height: 6, backgroundColor: wf.gray300, borderRadius: 3 },
    progressFill: { height: '100%', backgroundColor: wf.gray700, borderRadius: 3 },
    lightingAlert: {
      padding: '8px 10px',
      backgroundColor: wf.bg,
      border: `1px solid ${wf.gray500}`,
      borderRadius: 4,
      display: 'flex',
      gap: 6,
      alignItems: 'flex-start',
    },
    lightingText: { fontSize: 11, color: wf.gray700 },
    privacy: {
      padding: '8px 10px',
      backgroundColor: wf.bg,
      border: `1px dashed ${wf.gray300}`,
      borderRadius: 4,
    },
    privacyRow: { display: 'flex', alignItems: 'flex-start', gap: 6 },
    privacyText: { fontSize: 10, color: wf.gray500, margin: 0 },
  })
);

interface Participant {
  id: string;
  name: string;
  role: 'profesor' | 'estudiante';
  handRaised: boolean;
}

/** S3 — Student in-session view: participants + main video + chat/attention panel. Design mock. */
export default function S3StudentSession() {
  const classes = useStyles();
  const { chat, studentSelf, studentSession, students } = mockData;

  const [activeTab, setActiveTab] = useState<'chat' | 'atencion'>('chat');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(studentSession.degradedResolution);

  const participants: Participant[] = [
    { id: 'prof', name: studentSession.professor, role: 'profesor', handRaised: false },
    ...students.map(s => ({
      id: `s-${s.id}`,
      name: s.name,
      role: 'estudiante' as const,
      handRaised: s.handRaised,
    })),
  ];

  const posture = postureMap[studentSelf.posture];
  const q = studentSession.connectionQuality;

  return (
    <div className={classes.root}>
      {/* Degradation notice (US10) */}
      {bannerOpen && (
        <div className={classes.banner}>
          <WarningIcon style={{ fontSize: 14, color: wf.gray700 }} />
          <span className={classes.bannerText}>Resolución reducida por baja conectividad</span>
          <USTag ids={['US10']} />
          <button type="button" className={classes.bannerClose} onClick={() => setBannerOpen(false)}>
            ✕ Cerrar
          </button>
        </div>
      )}

      <div className={classes.layout}>
        {/* LEFT: participants */}
        <div className={classes.left}>
          <div className={classes.leftHead}>
            <Typography className={classes.leftTitle}>Participantes</Typography>
            <span className={classes.countBadge}>{participants.length}</span>
          </div>
          <USTag ids={['US04']} />

          <div className={classes.participants}>
            {participants.map(p => (
              <div key={p.id} className={classes.participant}>
                <div
                  className={classes.avatar}
                  style={{ backgroundColor: p.role === 'profesor' ? wf.gray700 : wf.gray300 }}
                >
                  <PersonIcon style={{ fontSize: 16, color: p.role === 'profesor' ? wf.white : wf.gray500 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={classes.participantName}>{p.name}</p>
                  {p.role === 'profesor' && <span className={classes.participantRole}>Docente</span>}
                </div>
                {p.handRaised && <PanToolIcon style={{ fontSize: 12, color: wf.gray700 }} />}
              </div>
            ))}
            <USTag ids={['US14']} />
          </div>

          {/* Notifications (US16) */}
          <div className={classes.notifs}>
            <span className={classes.notifsTitle}>Notificaciones</span>
            {studentSession.notifications.map(n => {
              const Icon = notifIcon[n.kind];
              return (
                <div key={n.id} className={classes.notif}>
                  <Icon style={{ fontSize: 11, color: wf.gray700 }} />
                  <span className={classes.notifText}>{n.text}</span>
                </div>
              );
            })}
            <USTag ids={['US16']} />
          </div>
        </div>

        {/* CENTER: main video */}
        <div className={classes.center}>
          <div className={classes.stage}>
            <div className={classes.mainTile}>
              <VideocamIcon style={{ fontSize: 56, color: wf.darkFgFaint }} />
              <span className={classes.speakerName}>{studentSession.activeSpeaker} (Orador activo)</span>
              <span className={classes.twilioBadge}>Twilio Video · WebRTC SFU</span>
              <USTag ids={['US02', 'US06']} className={classes.stageUs} />

              {/* Connection quality (US11) */}
              <div className={classes.quality}>
                <div className={classes.qualityBars}>
                  <div style={{ width: 3, height: 4, backgroundColor: wf.darkFgMuted, borderRadius: 1 }} />
                  <div
                    style={{
                      width: 3,
                      height: 7,
                      backgroundColor: q !== 'weak' ? wf.darkFgMuted : wf.darkFgDim,
                      borderRadius: 1,
                    }}
                  />
                  <div
                    style={{
                      width: 3,
                      height: 10,
                      backgroundColor: q === 'strong' ? wf.darkFgMuted : wf.darkFgDim,
                      borderRadius: 1,
                    }}
                  />
                </div>
                <span className={classes.qualityLabel}>
                  {q === 'strong' ? 'Buena' : q === 'medium' ? 'Media' : 'Débil'}
                </span>
              </div>
            </div>

            {/* Self preview (PiP) */}
            <div className={classes.pip}>
              <VideocamIcon style={{ fontSize: 20, color: wf.gray500 }} />
              <span className={classes.pipText}>Yo ({studentSession.selfName})</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className={classes.toolbar}>
            <ToolbarButton
              icon={micOn ? MicIcon : MicOffIcon}
              label={micOn ? 'Silenciar' : 'Activar mic'}
              active={micOn}
              onClick={() => setMicOn(v => !v)}
              usId="US07"
            />
            <ToolbarButton
              icon={camOn ? VideocamIcon : VideocamOffIcon}
              label={camOn ? 'Apagar cam.' : 'Activar cam.'}
              active={camOn}
              onClick={() => setCamOn(v => !v)}
              usId="US07"
            />
            <ToolbarButton icon={ScreenShareIcon} label="Compartir pantalla" disabled usId="US09" />
            <ToolbarButton
              icon={PanToolIcon}
              label={handRaised ? 'Bajar mano' : 'Levantar mano'}
              variant={handRaised ? 'active' : 'default'}
              onClick={() => setHandRaised(v => !v)}
              usId="US14"
            />
            <ToolbarButton icon={ChatIcon} label="Chat" active usId="US13" />
            <div className={classes.divider} />
            <ToolbarButton icon={ExitToAppIcon} label="Salir" variant="danger" usId="US04" />
          </div>
        </div>

        {/* RIGHT: chat / mi atención */}
        <div className={classes.right}>
          <div className={classes.tabs}>
            {(['chat', 'atencion'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${classes.tab} ${activeTab === tab ? classes.tabActive : classes.tabInactive}`}
              >
                {tab === 'chat' ? 'Chat' : 'Mi Atención'}
              </button>
            ))}
          </div>

          {activeTab === 'chat' ? (
            <div className={classes.chatPane}>
              <div className={classes.messages}>
                {chat.map(msg => (
                  <div key={msg.id}>
                    <div className={classes.msgHead}>
                      <span className={classes.msgAuthor}>{msg.self ? 'Tú' : msg.author}</span>
                      <span className={classes.msgTime}>{msg.time}</span>
                    </div>
                    <div className={classes.msgBubble}>{msg.text}</div>
                  </div>
                ))}
                <USTag ids={['US13']} />
              </div>
              <div className={classes.inputRow}>
                <input className={classes.input} placeholder="Escribe un mensaje..." readOnly />
                <button type="button" className={classes.sendBtn}>
                  Enviar
                </button>
              </div>
              <USTag ids={['US13']} />
            </div>
          ) : (
            <div className={classes.attentionPane}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AttentionGauge value={studentSelf.index} size={110} label="Mi índice de atención" />
              </div>
              <USTag ids={['US21']} />

              <div className={classes.sep} />

              {/* Camera capture (US17) */}
              <div className={classes.metricGroup}>
                <div className={classes.metricRow}>
                  <span className={classes.metricLabel}>Captura de cámara</span>
                  <span className={classes.chip}>{captureLabel[studentSelf.capture]}</span>
                </div>
                <USTag ids={['US17']} />
              </div>

              {/* Head orientation (US19) */}
              <div className={classes.metricGroup}>
                <div className={classes.metricRow}>
                  <span className={classes.metricLabel}>Orientación de cabeza</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowUpwardIcon style={{ fontSize: 14, color: wf.gray700 }} />
                    <span className={classes.metricValue}>
                      {studentSelf.headOrientation === 'front' ? 'Frente' : 'Desviada'}
                    </span>
                  </div>
                </div>
                <div className={classes.metricNote}>{headOrientation[studentSelf.headOrientation]}</div>
                <USTag ids={['US19']} />
              </div>

              {/* Posture (US20) */}
              <div className={classes.metricGroup}>
                <div className={classes.metricRow}>
                  <span className={classes.metricLabel}>Análisis de postura</span>
                  <span className={classes.metricValue}>{posture.label}</span>
                </div>
                <div className={classes.progressTrack}>
                  <div className={classes.progressFill} style={{ width: `${posture.pct}%` }} />
                </div>
                <USTag ids={['US20']} />
              </div>

              {/* Lighting alert (US22) — only when poor */}
              {studentSelf.lighting === 'low' && (
                <div className={classes.lightingAlert}>
                  <WarningIcon style={{ fontSize: 13, color: wf.gray700, marginTop: 1 }} />
                  <span className={classes.lightingText}>Iluminación insuficiente detectada</span>
                  <USTag ids={['US22']} />
                </div>
              )}

              <div className={classes.sep} />

              {/* Privacy (US23) */}
              <div className={classes.privacy}>
                <div className={classes.privacyRow}>
                  <VisibilityIcon style={{ fontSize: 12, color: wf.gray500, marginTop: 2 }} />
                  <p className={classes.privacyText}>Análisis procesado localmente — no se almacenan datos</p>
                </div>
                <USTag ids={['US23']} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

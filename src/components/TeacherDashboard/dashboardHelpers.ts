import React from 'react';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import EmojiEventsIcon from '@material-ui/icons/EmojiEvents';
import ScheduleIcon from '@material-ui/icons/Schedule';
import FolderIcon from '@material-ui/icons/Folder';
import EventIcon from '@material-ui/icons/Event';
import PictureAsPdfIcon from '@material-ui/icons/PictureAsPdf';
import BarChartIcon from '@material-ui/icons/BarChart';
import VideocamIcon from '@material-ui/icons/Videocam';

import { DashboardStatIcon, DashboardTabId, ResourceFileKind } from './types';

type IconComponent = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

/** Sidebar/tab nav icon, by tab id. */
export const dashboardTabIcon: Record<DashboardTabId, IconComponent> = {
  clases: MenuBookIcon,
  historial: ScheduleIcon,
  recursos: FolderIcon,
  calendario: EventIcon,
};

export const dashboardTabLabel: Record<DashboardTabId, string> = {
  clases: 'Clases',
  historial: 'Historial',
  recursos: 'Recursos',
  calendario: 'Calendario',
};

/** Stat-card icon, by DashboardStat.icon. */
export const statCardIcon: Record<DashboardStatIcon, IconComponent> = {
  book: MenuBookIcon,
  people: PeopleAltIcon,
  'trending-up': TrendingUpIcon,
  award: EmojiEventsIcon,
};

/** Resource file-card icon, by ResourceFile.kind. */
export const resourceKindIcon: Record<ResourceFileKind, IconComponent> = {
  pdf: PictureAsPdfIcon,
  presentation: BarChartIcon,
  video: VideocamIcon,
};

export type AttentionBarLevel = 'high' | 'medium' | 'low';

// Mirrors the AttentionProvider ranges convention (lowMax=40, mediumMax=70).
const ATTENTION_RANGES = { lowMax: 40, mediumMax: 70 };

/** Maps a 0-100 attention percentage to a level, using the same thresholds as GroupAttentionGauge. */
export function attentionLevelFromPercent(percent: number): AttentionBarLevel {
  if (percent <= ATTENTION_RANGES.lowMax) return 'low';
  if (percent <= ATTENTION_RANGES.mediumMax) return 'medium';
  return 'high';
}

// Same color triplet as ProfessorRoomShell/GroupAttentionGauge.tsx.
export const attentionLevelColor: Record<AttentionBarLevel, string> = {
  high: '#10b981',
  medium: '#ffb800',
  low: '#ef4444',
};

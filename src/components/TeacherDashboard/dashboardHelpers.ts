import React from 'react';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import EmojiEventsIcon from '@material-ui/icons/EmojiEvents';
import ScheduleIcon from '@material-ui/icons/Schedule';
import FolderIcon from '@material-ui/icons/Folder';
import EventIcon from '@material-ui/icons/Event';
import PictureAsPdfIcon from '@material-ui/icons/PictureAsPdf';
import SlideshowIcon from '@material-ui/icons/Slideshow';
import DescriptionIcon from '@material-ui/icons/Description';
import ArchiveIcon from '@material-ui/icons/Archive';
import VideocamIcon from '@material-ui/icons/Videocam';

import { DashboardStatIcon, DashboardTabId, ResourceFileKind } from './types';
import { attentionLevelFromScore } from '../AttentionProvider/attentionFormula';
import { attentionStatusColors } from '../../theme';

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

/** Real route for each tab, so it's reflected in the URL (bookmarks, refresh, back/forward). */
export const dashboardTabPath: Record<DashboardTabId, string> = {
  clases: '/dashboard/clases',
  historial: '/dashboard/historial',
  recursos: '/dashboard/recursos',
  calendario: '/dashboard/calendario',
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
  presentation: SlideshowIcon,
  word: DescriptionIcon,
  zip: ArchiveIcon,
  video: VideocamIcon,
};

export type AttentionBarLevel = 'high' | 'medium' | 'low';

/**
 * Maps a 0-100 attention percentage to a level, using the same thresholds as
 * AttentionProvider/GroupAttentionGauge (single source of truth: attentionFormula.ts).
 */
export function attentionLevelFromPercent(percent: number): AttentionBarLevel {
  return attentionLevelFromScore(percent);
}

// Same color triplet as ProfessorRoomShell/GroupAttentionGauge.tsx (single source
// of truth: theme.ts's attentionStatusColors).
export const attentionLevelColor: Record<AttentionBarLevel, string> = attentionStatusColors;

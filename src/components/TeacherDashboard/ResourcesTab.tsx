import React, { useState } from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import { ResourceClassGroup } from './types';
import { resourceKindIcon } from './dashboardHelpers';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
  },
  pillTabs: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
  },
  pill: {
    padding: theme.spacing(0.75, 2),
    borderRadius: 20,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pillActive: {
    backgroundColor: '#1d2f6f',
    borderColor: '#1d2f6f',
    color: '#ffffff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: theme.spacing(2.5),
  },
  fileCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  fileCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebab: {
    color: theme.palette.text.secondary,
    cursor: 'pointer',
  },
  fileName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  fileMeta: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  downloadButton: {
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  emptyTile: {
    border: '2px dashed #cbd5e1',
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    minHeight: 140,
  },
}));

interface Props {
  groups: ResourceClassGroup[];
}

/** "Recursos" tab: per-class file lists behind pill tabs. Upload/download/kebab are stubs. */
export default function ResourcesTab({ groups }: Props) {
  const classes = useStyles();
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id);
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  return (
    <div className={classes.root} data-testid="dashboard-resources-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>Recursos</div>
          <div className={classes.subtitle}>Materiales, presentaciones y grabaciones</div>
        </div>
        <button type="button" className={classes.uploadButton} data-testid="dashboard-upload-file-button">
          <AddIcon style={{ fontSize: 18 }} />
          Subir archivo
        </button>
      </div>

      <div className={classes.pillTabs}>
        {groups.map(group => (
          <button
            key={group.id}
            type="button"
            className={clsx(classes.pill, { [classes.pillActive]: group.id === activeGroup?.id })}
            onClick={() => setActiveGroupId(group.id)}
            data-testid={`dashboard-resources-pill-${group.id}`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className={classes.grid} data-testid="dashboard-resources-grid">
          {activeGroup.files.map(file => {
            const Icon = resourceKindIcon[file.kind];
            return (
              <div key={file.id} className={classes.fileCard} data-testid={`dashboard-resource-file-${file.id}`}>
                <div className={classes.fileCardHeader}>
                  <span className={classes.fileIconWrap}>
                    <Icon style={{ fontSize: 20 }} />
                  </span>
                  <MoreHorizIcon className={classes.kebab} style={{ fontSize: 20 }} />
                </div>
                <div className={classes.fileName}>{file.name}</div>
                <div className={classes.fileMeta}>
                  {file.sizeLabel} · {file.dateLabel}
                </div>
                <button type="button" className={classes.downloadButton} data-testid="dashboard-resource-download">
                  Descargar
                </button>
              </div>
            );
          })}
          <div className={classes.emptyTile} data-testid="dashboard-resources-empty-upload-tile">
            <AddIcon style={{ fontSize: 22 }} />
            Subir archivo
          </div>
        </div>
      )}
    </div>
  );
}

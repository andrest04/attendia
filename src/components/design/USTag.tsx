import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { wf } from './wireframe';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
    },
    tag: {
      fontSize: 9,
      color: wf.gray500,
      border: `1px solid ${wf.gray300}`,
      padding: '1px 4px',
      borderRadius: 2,
      letterSpacing: '0.02em',
      lineHeight: 1.4,
    },
  })
);

interface USTagProps {
  ids: string[];
  className?: string;
}

/** Annotation tag linking a UI element to its backlog User Story (e.g. [US01]). */
export default function USTag({ ids, className }: USTagProps) {
  const classes = useStyles();
  return (
    <div className={className ? `${classes.root} ${className}` : classes.root}>
      {ids.map(id => (
        <span key={id} className={classes.tag}>
          [{id}]
        </span>
      ))}
    </div>
  );
}

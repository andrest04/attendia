import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { isTeacherIdentity } from '../../../PreJoinScreens/classSessionTypes';

const useStyles = makeStyles(() =>
  createStyles({
    messageInfoContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1.425em 0 0.083em',
      fontSize: '12px',
      color: '#94a3b8',
    },
    author: {
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      fontSize: 12,
      lineHeight: '18px',
      color: '#1d2f6f',
    },
    authorTeacher: {
      color: '#1d6eed',
    },
    authorLocal: {
      color: '#1d2f6f',
    },
    timestamp: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: 10,
      color: '#94a3b8',
      lineHeight: '15px',
    },
    rightAligned: {
      flexDirection: 'row-reverse',
    },
  })
);

interface MessageInfoProps {
  author: string;
  dateCreated: string;
  isLocalParticipant: boolean;
}

export default function MessageInfo({ author, dateCreated, isLocalParticipant }: MessageInfoProps) {
  const classes = useStyles();
  const isTeacher = isTeacherIdentity(author);
  const displayName = author.replace(/\[Profesor\]/gi, '').trim();

  return (
    <div className={`${classes.messageInfoContainer}${isLocalParticipant ? ` ${classes.rightAligned}` : ''}`}>
      <div className={`${classes.author}${isTeacher ? ` ${classes.authorTeacher}` : ''}`}>
        {isLocalParticipant ? displayName : displayName}
      </div>
      <div className={classes.timestamp}>{dateCreated}</div>
    </div>
  );
}

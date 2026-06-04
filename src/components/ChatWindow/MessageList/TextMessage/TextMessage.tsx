import React from 'react';
import clsx from 'clsx';
import { Link } from '@material-ui/core';
import linkify from 'linkify-it';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
  // Wrapper aligns the bubble left (others) or right (local participant)
  messageWrapper: {
    display: 'flex',
  },
  messageWrapperLocal: {
    justifyContent: 'flex-end',
  },
  messageContainer: {
    borderRadius: '4px 14px 14px 14px',
    display: 'inline-block',
    padding: '10px 14px',
    margin: '0.3em 0 0',
    wordBreak: 'break-word',
    // Others: light blue-tinted bg
    backgroundColor: '#f0f5ff',
    border: '1px solid #e2ecf9',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    lineHeight: '19.5px',
    color: '#353535',
    hyphens: 'auto',
    whiteSpace: 'pre-wrap',
    maxWidth: '85%',
  },
  isLocalParticipant: {
    // Own messages: right-aligned tinted bubble, top-right corner squared
    borderRadius: '14px 4px 14px 14px',
    backgroundColor: '#ebf3ff',
    border: '1px solid rgba(29,110,237,0.18)',
  },
});

interface TextMessageProps {
  body: string;
  isLocalParticipant: boolean;
}

function addLinks(text: string) {
  const matches = linkify().match(text);
  if (!matches) return text;

  const results: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    results.push(text.slice(lastIndex, match.index));
    results.push(
      <Link target="_blank" rel="noreferrer" href={match.url} key={i}>
        {match.text}
      </Link>
    );
    lastIndex = match.lastIndex;
  });

  results.push(text.slice(lastIndex, text.length));

  return results;
}

export default function TextMessage({ body, isLocalParticipant }: TextMessageProps) {
  const classes = useStyles();

  return (
    <div className={clsx(classes.messageWrapper, { [classes.messageWrapperLocal]: isLocalParticipant })}>
      <div
        className={clsx(classes.messageContainer, {
          [classes.isLocalParticipant]: isLocalParticipant,
        })}
      >
        {addLinks(body)}
      </div>
    </div>
  );
}

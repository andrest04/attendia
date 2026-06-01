import React from 'react';
import clsx from 'clsx';
import { Link } from '@material-ui/core';
import linkify from 'linkify-it';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
  messageContainer: {
    borderRadius: '8px',
    display: 'block',
    padding: '0.55em 0.8em',
    margin: '0.3em 0 0',
    wordBreak: 'break-word',
    backgroundColor: '#F4F5F7',
    border: '1px solid #E4E7E9',
    fontSize: '13px',
    hyphens: 'auto',
    whiteSpace: 'pre-wrap',
  },
  isLocalParticipant: {
    backgroundColor: '#E9F2FF',
    borderColor: '#CCE4FF',
  },
});

interface TextMessageProps {
  body: string;
  isLocalParticipant: boolean;
}

function addLinks(text: string) {
  const matches = linkify().match(text);
  if (!matches) return text;

  const results = [];
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
    <div>
      <div
        className={clsx(classes.messageContainer, {
          [classes.isLocalParticipant]: isLocalParticipant,
        })}
      >
        <div>{addLinks(body)}</div>
      </div>
    </div>
  );
}

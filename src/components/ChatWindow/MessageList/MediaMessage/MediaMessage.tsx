import FileDownloadIcon from '../../../../icons/FileDownloadIcon';
import { makeStyles } from '@material-ui/core/styles';
import { Media } from '@twilio/conversations';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
  messageContainer: {
    display: 'flex',
    padding: '0.9em 1.5em',
    margin: '0.6em 0',
    border: '2px solid #e4e7e9',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  mediaInfo: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: '1.5em',
    minWidth: 0,
    '& p': {
      margin: 0,
      fontSize: '12px',
    },
  },
  filename: {
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  size: {
    fontWeight: 400,
  },
});

interface MediaMessageProps {
  media: Media;
}

export function formatFileSize(bytes: number, suffixIndex = 0, byteUnit = 'bytes'): string {
  const suffixes = [byteUnit, 'KB', 'MB', 'GB'];
  if (bytes < 1000) return +bytes.toFixed(2) + ' ' + suffixes[suffixIndex];
  return formatFileSize(bytes / 1024, suffixIndex + 1, byteUnit);
}

export default function FileMessage({ media }: MediaMessageProps) {
  const classes = useStyles();
  const { t } = useTranslation('chat');

  const handleClick = () => {
    media.getContentTemporaryUrl().then(url => {
      const anchorEl = document.createElement('a');

      anchorEl.href = url!;
      anchorEl.target = '_blank';
      anchorEl.rel = 'noopener';

      // setTimeout is needed in order to open files in iOS Safari.
      setTimeout(() => {
        anchorEl.click();
      });
    });
  };

  return (
    <button type="button" className={classes.messageContainer} onClick={handleClick} aria-label={t('openFile', { filename: media.filename })}>
      <div className={classes.iconContainer}>
        <FileDownloadIcon />
      </div>
      <div className={classes.mediaInfo}>
        <p className={classes.filename}>{media.filename}</p>
        <p className={classes.size}>
          {formatFileSize(media.size, 0, t('byteUnit'))} - {t('clickToOpen')}
        </p>
      </div>
    </button>
  );
}

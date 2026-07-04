import React, { useContext, useMemo } from 'react';
import ArrowBack from '@material-ui/icons/ArrowBack';
import ArrowForward from '@material-ui/icons/ArrowForward';
import clsx from 'clsx';
import { GALLERY_VIEW_ASPECT_RATIO, GALLERY_VIEW_MARGIN } from '../../constants';
import { IconButton, makeStyles, createStyles, Theme } from '@material-ui/core';
import { Pagination } from '@material-ui/lab';
import Participant from '../Participant/Participant';
import { ParticipantTileAttention } from '../ParticipantInfo/ParticipantInfo';
import useGalleryViewLayout from '../../hooks/useGalleryViewLayout/useGalleryViewLayout';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useParticipantsContext from '../../hooks/useParticipantsContext/useParticipantsContext';
import { usePagination } from './usePagination/usePagination';
import useDominantSpeaker from '../../hooks/useDominantSpeaker/useDominantSpeaker';
import { useAppState } from '../../state';
import { AttentionContext } from '../AttentionProvider';
import { isTeacherIdentity } from '../PreJoinScreens/classSessionTypes';

const CONTAINER_GUTTER = '50px';
// On a narrow desktop/tablet window the fixed 50px gutter eats a disproportionate
// share of the stage on all four sides — shrink it below the md breakpoint.
const CONTAINER_GUTTER_NARROW = '24px';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      background: theme.galleryViewBackgroundColor,
      // Fill the shell's stage area. The legacy `gridArea` sizing no longer applies
      // now that GalleryView renders inside the Professor/Student room shells, so
      // without an explicit fill the container collapses and the tiles shrink.
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    participantContainer: {
      position: 'absolute',
      display: 'flex',
      top: CONTAINER_GUTTER,
      right: CONTAINER_GUTTER,
      bottom: CONTAINER_GUTTER,
      left: CONTAINER_GUTTER,
      margin: '0 auto',
      alignContent: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center',
      [theme.breakpoints.down('md')]: {
        top: CONTAINER_GUTTER_NARROW,
        right: CONTAINER_GUTTER_NARROW,
        bottom: CONTAINER_GUTTER_NARROW,
        left: CONTAINER_GUTTER_NARROW,
      },
    },
    buttonContainer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },

    buttonContainerLeft: {
      right: `calc(100% - ${CONTAINER_GUTTER})`,
      left: 0,
      [theme.breakpoints.down('md')]: {
        right: `calc(100% - ${CONTAINER_GUTTER_NARROW})`,
      },
    },
    buttonContainerRight: {
      right: 0,
      left: `calc(100% - ${CONTAINER_GUTTER})`,
      [theme.breakpoints.down('md')]: {
        left: `calc(100% - ${CONTAINER_GUTTER_NARROW})`,
      },
    },
    pagination: {
      '& .MuiPaginationItem-root': {
        color: 'white',
      },
    },
    paginationButton: {
      color: 'black',
      background: 'rgba(255, 255, 255, 0.8)',
      width: '40px',
      height: '40px',
      '&:hover': {
        background: 'rgba(255, 255, 255)',
      },
    },
    paginationContainer: {
      position: 'absolute',
      top: `calc(100% - ${CONTAINER_GUTTER})`,
      right: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    studentCount: {
      position: 'absolute',
      top: 16,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: 'white',
      fontSize: 12,
      zIndex: 6,
      pointerEvents: 'none',
    },
  })
);

export function GalleryView() {
  const classes = useStyles();
  const { maxGalleryViewParticipants } = useAppState();
  const { room } = useVideoContext();
  const { galleryViewParticipants } = useParticipantsContext();
  const dominantSpeaker = useDominantSpeaker(true);

  // Attention overlays are read defensively (the context is null outside the
  // provider, e.g. in unit tests) and surfaced on the professor's gallery only.
  const attention = useContext(AttentionContext);
  const isTeacher = isTeacherIdentity(room?.localParticipant?.identity);
  const attentionByIdentity = useMemo(() => {
    const byIdentity = new Map<string, ParticipantTileAttention>();
    if (isTeacher && attention) {
      attention.participants.forEach(p =>
        byIdentity.set(p.identity, { level: p.level, multiface: p.multiface, cameraOff: p.cameraOff })
      );
    }
    return byIdentity;
  }, [isTeacher, attention]);

  // Everyone — students and professors alike — sees their own tile as a regular,
  // equal-sized cell in the gallery (local participant first). Students used to be
  // relegated to a tiny PiP self-view; that was removed in favour of parity with the
  // professor layout.
  const galleryParticipantList = [room!.localParticipant, ...galleryViewParticipants];

  const { paginatedParticipants, setCurrentPage, currentPage, totalPages } = usePagination(galleryParticipantList);

  const visibleStudentCount = paginatedParticipants.filter(participant => participant !== room!.localParticipant)
    .length;
  const totalStudentCount = galleryViewParticipants.length;

  const galleryViewLayoutParticipantCount =
    currentPage === 1 ? paginatedParticipants.length : maxGalleryViewParticipants;
  const { participantVideoWidth, containerRef } = useGalleryViewLayout(galleryViewLayoutParticipantCount);

  const participantWidth = `${participantVideoWidth}px`;
  const participantHeight = `${Math.floor(participantVideoWidth * GALLERY_VIEW_ASPECT_RATIO)}px`;

  return (
    <div className={classes.container}>
      {isTeacher && totalStudentCount > 0 && (
        <div className={classes.studentCount} data-testid="gallery-student-count">
          Mostrando {visibleStudentCount} / {totalStudentCount} estudiantes
        </div>
      )}
      <div className={clsx(classes.buttonContainer, classes.buttonContainerLeft)}>
        {!(currentPage === 1) && (
          <IconButton className={classes.paginationButton} onClick={() => setCurrentPage(page => page - 1)}>
            <ArrowBack />
          </IconButton>
        )}
      </div>
      <div className={clsx(classes.buttonContainer, classes.buttonContainerRight)}>
        {!(currentPage === totalPages) && (
          <IconButton className={classes.paginationButton} onClick={() => setCurrentPage(page => page + 1)}>
            <ArrowForward />
          </IconButton>
        )}
      </div>
      <div className={classes.paginationContainer}>
        {totalPages > 1 && (
          <Pagination
            className={classes.pagination}
            page={currentPage}
            count={totalPages}
            onChange={(_, value) => setCurrentPage(value)}
            shape="rounded"
            color="primary"
            size="small"
            hidePrevButton
            hideNextButton
          />
        )}
      </div>
      <div className={classes.participantContainer} ref={containerRef}>
        {paginatedParticipants.map(participant => (
          <div
            key={participant.sid}
            style={{ width: participantWidth, height: participantHeight, margin: GALLERY_VIEW_MARGIN }}
          >
            <Participant
              participant={participant}
              isLocalParticipant={participant === room!.localParticipant}
              isDominantSpeaker={participant === dominantSpeaker}
              attention={
                participant === room!.localParticipant ? undefined : attentionByIdentity.get(participant.identity)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import { CSSProperties } from 'react';
import clsx from 'clsx';
import { makeStyles, createStyles, Theme, useMediaQuery } from '@material-ui/core';
import Participant from '../Participant/Participant';
import useDominantSpeaker from '../../hooks/useDominantSpeaker/useDominantSpeaker';
import useParticipantContext from '../../hooks/useParticipantsContext/useParticipantsContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import { Pagination } from 'swiper';
import { Participant as IParticipant } from 'twilio-video';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    participantContainer: {
      background: theme.galleryViewBackgroundColor,
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      height: '100%',
      '& .swiper': {
        height: '100%',
        '--swiper-pagination-bullet-inactive-color': 'white',
      },
      '& .swiper-wrapper': {
        height: '100%',
      },
      '& .swiper-pagination.swiper-pagination-bullets': {
        bottom: '5px',
      },
    },
    isPaginationActive: {
      '& .swiper-slide': {
        // To leave room for the pagination indicators:
        height: 'calc(100% - 21px)',
        paddingBottom: '21px',
      },
    },
    swiperSlide: {
      display: 'flex',
      flexWrap: 'wrap',
      alignSelf: 'center',
      alignContent: 'flex-start',
    },
  })
);

export function MobileGalleryView() {
  const classes = useStyles();
  const isMobileLandscape = useMediaQuery('screen and (orientation: landscape)');
  const { room } = useVideoContext();
  const { mobileGalleryViewParticipants } = useParticipantContext();
  const dominantSpeaker = useDominantSpeaker(true);
  const remoteParticipantCount = mobileGalleryViewParticipants.length;

  const pages: IParticipant[][] = [[]];
  // Add the localParticipant to the front of the array to ensure they are always the first participant:
  pages[0].push(room!.localParticipant);

  for (let i = 0; i < remoteParticipantCount; i++) {
    const pageNumber = Math.floor(i / 6);
    if (!pages[pageNumber]) {
      pages[pageNumber] = [];
    }
    // Each page should have a max of 6 participants:
    if (pages[pageNumber].length < 6) {
      pages[pageNumber].push(mobileGalleryViewParticipants[i]);
    } else {
      pages[pageNumber + 1] = [mobileGalleryViewParticipants[i]];
    }
  }

  // The size of each tile is driven by how many participants share THIS page, not the
  // grand total across every swipe page — otherwise a trailing page (e.g. the 7th
  // participant alone on page 2) renders at the tiny multi-tile size instead of filling
  // the screen. `count` mirrors the original remoteParticipantCount steps by treating the
  // page as "1 anchor tile + count more", which holds whether or not that anchor is the
  // local participant (only present on page 0).
  function getParticipantVideoStyles(pageParticipantCount: number, isLandscape: boolean): CSSProperties {
    const count = Math.max(0, pageParticipantCount - 1);
    const sizeStep = ['100%', '50%', '33.33%', '50%', '33.33%'][Math.min(count, 4)];
    return isLandscape
      ? { height: count < 3 ? '100%' : '50%', width: sizeStep, padding: '0.2em 0.1em', boxSizing: 'border-box' }
      : { width: count < 3 ? '100%' : '50%', height: sizeStep, padding: '0.2em', boxSizing: 'border-box' };
  }

  return (
    <div className={clsx(classes.participantContainer, { [classes.isPaginationActive]: remoteParticipantCount > 5 })}>
      <Swiper pagination={true} modules={[Pagination]} className="mySwiper">
        {pages.map((page, i) => {
          const participantVideoStyles = getParticipantVideoStyles(page.length, isMobileLandscape);
          return (
            <SwiperSlide key={i} className={classes.swiperSlide}>
              {page.map(participant => (
                <div data-test-id="participantContainer" style={participantVideoStyles} key={participant.sid}>
                  <Participant
                    participant={participant}
                    isLocalParticipant={room!.localParticipant === participant}
                    isDominantSpeaker={dominantSpeaker === participant}
                  />
                </div>
              ))}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

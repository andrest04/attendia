import React from 'react';
import { mount } from 'enzyme';
import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import { ParticipantProvider } from './index';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useDominantSpeaker from '../../hooks/useDominantSpeaker/useDominantSpeaker';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useParticipantContext from '../../hooks/useParticipantsContext/useParticipantsContext';

jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../state', () => ({ useAppState: () => ({ maxGalleryViewParticipants: 6 }) }));

const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const wrapper: React.FC = ({ children }) => <ParticipantProvider>{children}</ParticipantProvider>;

const makeParticipant = (sid: string): any => ({ sid, identity: sid, tracks: new Map() });

const makeRoom = (sids: string[] = []): any => {
  const room: any = new EventEmitter();
  room.setMaxListeners(100);
  room.participants = new Map(sids.map(sid => [sid, makeParticipant(sid)]));
  room.dominantSpeaker = null;
  room.localParticipant = Object.assign(new EventEmitter(), { sid: 'me', identity: 'me', tracks: new Map() });
  return room;
};

const roomListenerCount = (room: any) =>
  ['participantConnected', 'participantDisconnected', 'dominantSpeakerChanged', 'trackPublished'].reduce(
    (total, event) => total + room.listenerCount(event),
    0
  );

describe('the ParticipantProvider component', () => {
  let room: any;

  beforeEach(() => {
    room = makeRoom(['a', 'b', 'c']);
    mockUseVideoContext.mockImplementation(() => ({ room }));
  });

  it('exposes the three ordered participant lists through the participant context', () => {
    const { result } = renderHook(() => useParticipantContext(), { wrapper });

    expect(result.current.speakerViewParticipants.map(p => p.sid)).toEqual(['a', 'b', 'c']);
    expect(result.current.galleryViewParticipants.map(p => p.sid)).toEqual(['a', 'b', 'c']);
    expect(result.current.mobileGalleryViewParticipants.map(p => p.sid)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the speaker-view order across renders: the latest dominant speaker moves to the front', () => {
    const { result } = renderHook(() => useParticipantContext(), { wrapper });

    act(() => {
      room.emit('dominantSpeakerChanged', room.participants.get('c'));
    });
    expect(result.current.speakerViewParticipants.map(p => p.sid)).toEqual(['c', 'a', 'b']);

    act(() => {
      room.emit('dominantSpeakerChanged', room.participants.get('b'));
    });
    expect(result.current.speakerViewParticipants.map(p => p.sid)).toEqual(['b', 'c', 'a']);
  });

  it('adds and removes participants in every list as they connect and disconnect', () => {
    const { result } = renderHook(() => useParticipantContext(), { wrapper });

    act(() => {
      room.emit('participantConnected', makeParticipant('d'));
    });
    expect(result.current.galleryViewParticipants.map(p => p.sid)).toEqual(['a', 'b', 'c', 'd']);

    act(() => {
      room.emit('participantDisconnected', room.participants.get('a'));
    });
    expect(result.current.galleryViewParticipants.map(p => p.sid)).toEqual(['b', 'c', 'd']);
    expect(result.current.speakerViewParticipants.map(p => p.sid)).toEqual(['b', 'c', 'd']);
  });

  describe('shared room state', () => {
    it('serves the roster, dominant speaker and screen share to the ordinary hooks', () => {
      const { result } = renderHook(
        () => ({
          participants: useParticipants(),
          dominantSpeaker: useDominantSpeaker(),
          screenShare: useScreenShareParticipant(),
        }),
        { wrapper }
      );
      expect(result.current.participants.map(p => p.sid)).toEqual(['a', 'b', 'c']);
      expect(result.current.dominantSpeaker).toBeNull();
      expect(result.current.screenShare).toBeUndefined();

      act(() => {
        room.emit('dominantSpeakerChanged', room.participants.get('b'));
        room.emit('participantConnected', makeParticipant('d'));
      });
      expect(result.current.dominantSpeaker!.sid).toBe('b');
      expect(result.current.participants.map(p => p.sid)).toEqual(['a', 'b', 'c', 'd']);

      act(() => {
        const sharer = room.participants.get('c');
        sharer.tracks.set('t1', { trackName: 'screen' });
        room.emit('trackPublished');
      });
      expect(result.current.screenShare!.sid).toBe('c');
    });

    it('does not attach more room listeners when more components consume the hooks', () => {
      const Consumer = () => {
        useParticipants();
        useDominantSpeaker();
        useScreenShareParticipant();
        return null;
      };
      const mountWith = (consumers: number) => {
        const targetRoom = makeRoom(['a', 'b', 'c']);
        mockUseVideoContext.mockImplementation(() => ({ room: targetRoom }));
        const tree = mount(
          <ParticipantProvider>
            {Array.from({ length: consumers }, (_, index) => (
              <Consumer key={index} />
            ))}
          </ParticipantProvider>
        );
        const count = roomListenerCount(targetRoom);
        tree.unmount();
        return count;
      };

      // Ten consumers of each shared hook subscribe exactly as many times as none.
      expect(mountWith(10)).toBe(mountWith(0));
    });

    it('still gives a consumer asking for null speakers its own subscription', () => {
      const { result } = renderHook(
        () => ({ withNulls: useDominantSpeaker(true), withoutNulls: useDominantSpeaker() }),
        { wrapper }
      );

      act(() => {
        room.emit('dominantSpeakerChanged', room.participants.get('a'));
        room.emit('dominantSpeakerChanged', null);
      });

      expect(result.current.withNulls).toBeNull();
      expect(result.current.withoutNulls!.sid).toBe('a'); // nulls are ignored for the shared value
    });
  });

  it('unsubscribes everything from the room on unmount', () => {
    const { unmount } = renderHook(() => useParticipantContext(), { wrapper });
    expect(roomListenerCount(room)).toBeGreaterThan(0);

    unmount();

    expect(roomListenerCount(room)).toBe(0);
  });

  it('keeps standalone hooks working without a provider (tests, Storybook)', () => {
    const { result } = renderHook(() => ({ participants: useParticipants(), dominantSpeaker: useDominantSpeaker() }));

    expect(result.current.participants.map(p => p.sid)).toEqual(['a', 'b', 'c']);
    act(() => {
      room.emit('dominantSpeakerChanged', room.participants.get('a'));
    });
    expect(result.current.dominantSpeaker!.sid).toBe('a');
  });
});

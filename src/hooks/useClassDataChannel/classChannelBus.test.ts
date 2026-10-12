import EventEmitter from 'events';
import { LocalDataTrack } from 'twilio-video';
import { joinClassChannel } from './classChannelBus';

const mockSend = jest.fn();
jest.mock('twilio-video', () => ({
  __esModule: true,
  LocalDataTrack: jest.fn().mockImplementation(() => ({ kind: 'data', send: mockSend })),
}));

const MockLocalDataTrack = (LocalDataTrack as unknown) as jest.Mock;

const makeRoom = (): any => {
  const room: any = new EventEmitter();
  room.participants = new Map();
  room.localParticipant = {
    identity: 'me',
    publishTrack: jest.fn(() => Promise.resolve()),
    unpublishTrack: jest.fn(),
  };
  return room;
};

const makeParticipant = (identity: string): any => Object.assign(new EventEmitter(), { identity, tracks: new Map() });

const makeRemoteDataTrack = (): any => Object.assign(new EventEmitter(), { kind: 'data' });

const makeListener = () => ({
  onMessage: jest.fn(),
  onParticipantConnected: jest.fn(),
  onParticipantDisconnected: jest.fn(),
});

const flushPromises = () => Promise.resolve().then(() => Promise.resolve());

describe('the class channel bus', () => {
  let room: any;

  beforeEach(() => {
    jest.clearAllMocks();
    room = makeRoom();
  });

  describe('publishing', () => {
    it('shares ONE reliable track between every consumer of the same room', () => {
      joinClassChannel(room, undefined, makeListener());
      joinClassChannel(room, undefined, makeListener());
      joinClassChannel(room, undefined, makeListener());

      expect(MockLocalDataTrack).toHaveBeenCalledTimes(1);
      expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    });

    it('keeps reliable and unreliable consumers on separate tracks (reliability must not be merged)', () => {
      joinClassChannel(room, undefined, makeListener());
      joinClassChannel(room, { ordered: false, maxRetransmits: 0 }, makeListener());
      joinClassChannel(room, { ordered: false, maxRetransmits: 0 }, makeListener());

      expect(MockLocalDataTrack).toHaveBeenCalledTimes(2);
      expect(MockLocalDataTrack.mock.calls[0]).toEqual([]);
      expect(MockLocalDataTrack.mock.calls[1]).toEqual([{ ordered: false, maxRetransmits: 0 }]);
    });

    it('keeps rooms independent', () => {
      joinClassChannel(room, undefined, makeListener());
      joinClassChannel(makeRoom(), undefined, makeListener());

      expect(MockLocalDataTrack).toHaveBeenCalledTimes(2);
    });

    it('send() JSON-encodes the payload and swallows a track that is not ready', () => {
      const channel = joinClassChannel(room, undefined, makeListener());

      channel.send({ type: 'ping' });
      expect(mockSend).toHaveBeenCalledWith('{"type":"ping"}');

      mockSend.mockImplementationOnce(() => {
        throw new Error('not connected');
      });
      expect(() => channel.send({ type: 'ping' })).not.toThrow();
    });
  });

  describe('receiving', () => {
    it('attaches one receive loop per room, however many consumers', () => {
      joinClassChannel(room, undefined, makeListener());
      joinClassChannel(room, undefined, makeListener());

      expect(room.listenerCount('participantConnected')).toBe(1);
      expect(room.listenerCount('participantDisconnected')).toBe(1);
    });

    it('parses each message once and delivers it to every consumer with the sending participant', () => {
      const first = makeListener();
      const second = makeListener();
      joinClassChannel(room, undefined, first);
      joinClassChannel(room, undefined, second);
      const participant = makeParticipant('ana');
      const track = makeRemoteDataTrack();
      participant.tracks.set('t', { track });
      room.participants.set('ana', participant);
      // Re-attach through the connect path so the existing participant's track is picked up.
      room.emit('participantConnected', participant);

      const parse = jest.spyOn(JSON, 'parse');
      track.emit('message', '{"type":"raise-hand","raised":true}');

      expect(first.onMessage).toHaveBeenCalledWith({ type: 'raise-hand', raised: true }, participant);
      expect(second.onMessage).toHaveBeenCalledWith({ type: 'raise-hand', raised: true }, participant);
      expect(parse).toHaveBeenCalledTimes(1);
      parse.mockRestore();
    });

    it('listens to tracks of participants already in the room and to tracks subscribed later', () => {
      const existing = makeParticipant('already-here');
      const earlyTrack = makeRemoteDataTrack();
      existing.tracks.set('t', { track: earlyTrack });
      room.participants.set('already-here', existing);
      const listener = makeListener();
      joinClassChannel(room, undefined, listener);

      earlyTrack.emit('message', '{"n":1}');
      const lateTrack = makeRemoteDataTrack();
      existing.emit('trackSubscribed', lateTrack);
      lateTrack.emit('message', '{"n":2}');

      expect(listener.onMessage).toHaveBeenCalledWith({ n: 1 }, existing);
      expect(listener.onMessage).toHaveBeenCalledWith({ n: 2 }, existing);
    });

    it('ignores non-string and malformed payloads, and non-data tracks', () => {
      const listener = makeListener();
      joinClassChannel(room, undefined, listener);
      const participant = makeParticipant('ana');
      room.emit('participantConnected', participant);
      const track = makeRemoteDataTrack();
      participant.emit('trackSubscribed', track);

      track.emit('message', new ArrayBuffer(2));
      track.emit('message', 'not json');
      const videoTrack = Object.assign(new EventEmitter(), { kind: 'video' });
      participant.emit('trackSubscribed', videoTrack);
      videoTrack.emit('message', '{"n":1}');

      expect(listener.onMessage).not.toHaveBeenCalled();
    });

    it('does not attach the same track twice', () => {
      const listener = makeListener();
      joinClassChannel(room, undefined, listener);
      const participant = makeParticipant('ana');
      room.emit('participantConnected', participant);
      const track = makeRemoteDataTrack();

      participant.emit('trackSubscribed', track);
      participant.emit('trackSubscribed', track);
      track.emit('message', '{"n":1}');

      expect(listener.onMessage).toHaveBeenCalledTimes(1);
    });

    it('a failing consumer does not starve the others', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const failing = {
        ...makeListener(),
        onMessage: jest.fn(() => {
          throw new Error('boom');
        }),
      };
      const healthy = makeListener();
      joinClassChannel(room, undefined, failing);
      joinClassChannel(room, undefined, healthy);
      const participant = makeParticipant('ana');
      room.emit('participantConnected', participant);
      const track = makeRemoteDataTrack();
      participant.emit('trackSubscribed', track);

      track.emit('message', '{"n":1}');

      expect(healthy.onMessage).toHaveBeenCalledWith({ n: 1 }, participant);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('participant lifecycle', () => {
    it('tells every consumer when a participant connects (after attaching them) and disconnects', () => {
      const first = makeListener();
      const second = makeListener();
      joinClassChannel(room, undefined, first);
      joinClassChannel(room, undefined, second);
      const participant = makeParticipant('ana');

      room.emit('participantConnected', participant);
      room.emit('participantDisconnected', participant);

      [first, second].forEach(listener => {
        expect(listener.onParticipantConnected).toHaveBeenCalledWith(participant);
        expect(listener.onParticipantDisconnected).toHaveBeenCalledWith(participant);
      });
    });

    it("prunes a disconnected participant's listeners", () => {
      joinClassChannel(room, undefined, makeListener());
      const participant = makeParticipant('ana');
      room.emit('participantConnected', participant);
      expect(participant.listenerCount('trackSubscribed')).toBe(1);

      room.emit('participantDisconnected', participant);

      expect(participant.listenerCount('trackSubscribed')).toBe(0);
    });
  });

  describe('leaving', () => {
    it('keeps the shared track and receive loop while any consumer remains', async () => {
      const first = joinClassChannel(room, undefined, makeListener());
      joinClassChannel(room, undefined, makeListener());

      first.leave();
      await flushPromises();

      expect(room.localParticipant.unpublishTrack).not.toHaveBeenCalled();
      expect(room.listenerCount('participantConnected')).toBe(1);
    });

    it('unpublishes the track and detaches the receive loop when the last consumer leaves', async () => {
      const first = joinClassChannel(room, undefined, makeListener());
      const second = joinClassChannel(room, undefined, makeListener());

      first.leave();
      second.leave();
      await flushPromises();

      expect(room.localParticipant.unpublishTrack).toHaveBeenCalledTimes(1);
      expect(room.listenerCount('participantConnected')).toBe(0);
      expect(room.listenerCount('participantDisconnected')).toBe(0);
    });

    it('waits for an in-flight publish before unpublishing (fast unmount/remount)', async () => {
      let finishPublishing: () => void = () => undefined;
      room.localParticipant.publishTrack.mockReturnValueOnce(
        new Promise<void>(resolve => {
          finishPublishing = resolve;
        })
      );
      const channel = joinClassChannel(room, undefined, makeListener());

      channel.leave();
      await flushPromises();
      expect(room.localParticipant.unpublishTrack).not.toHaveBeenCalled();

      finishPublishing();
      await flushPromises();
      expect(room.localParticipant.unpublishTrack).toHaveBeenCalledTimes(1);
    });

    it('starts from scratch after everyone left (a remount publishes a fresh track)', () => {
      joinClassChannel(room, undefined, makeListener()).leave();
      joinClassChannel(room, undefined, makeListener());

      expect(MockLocalDataTrack).toHaveBeenCalledTimes(2);
      expect(room.listenerCount('participantConnected')).toBe(1);
    });

    it('leave() is idempotent and send() is a no-op afterwards', () => {
      const channel = joinClassChannel(room, undefined, makeListener());
      channel.leave();
      channel.leave();

      channel.send({ type: 'ping' });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});

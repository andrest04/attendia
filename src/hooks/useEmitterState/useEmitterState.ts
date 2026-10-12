import { useEffect, useState } from 'react';
import useLatest from '../useLatest/useLatest';

/**
 * Observer adapter between an event source and React state.
 *
 * Twilio's Room, Participant and Track objects (and DOM media tracks) are the source of
 * truth; React only mirrors them. Every hook that did so repeated the same skeleton:
 * `useState(initial)` + an effect that re-syncs when the subject changes, subscribes, and
 * unsubscribes with the very same handler instances. This hook is that skeleton.
 *
 * - `read(subject)` computes the state from the subject. It seeds the initial state and
 *   re-syncs whenever the subject itself changes (it also receives `null`/`undefined`).
 * - `handlers` maps an event name to a function returning the NEXT state. Handlers are
 *   deliberately value-based rather than "re-read the subject": they receive the event's
 *   arguments, so an event can carry its own value.
 *
 * `read` and `handlers` may be inline — they are read through a ref at event time, so
 * subscriptions are only re-made when the subject changes.
 */
interface EventEmitterLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
}

interface EventTargetLike {
  addEventListener(event: string, listener: (...args: any[]) => void): unknown;
  removeEventListener(event: string, listener: (...args: any[]) => void): unknown;
}

export type EventSource = EventEmitterLike | EventTargetLike;

export type EmitterHandlers<Subject, State> = {
  [eventName: string]: (subject: NonNullable<Subject>, ...eventArgs: any[]) => State;
};

function subscribe(source: EventSource, event: string, listener: (...args: any[]) => void): () => void {
  if ('on' in source && typeof source.on === 'function') {
    source.on(event, listener);
    return () => {
      source.off(event, listener);
    };
  }
  const target = source as EventTargetLike;
  target.addEventListener(event, listener);
  return () => {
    target.removeEventListener(event, listener);
  };
}

export default function useEmitterState<Subject extends EventSource | null | undefined, State>(
  subject: Subject,
  read: (subject: Subject) => State,
  handlers: EmitterHandlers<Subject, State>,
  options: { initial?: State } = {}
): State {
  const latest = useLatest({ read, handlers });
  const [state, setState] = useState<State>(() => ('initial' in options ? (options.initial as State) : read(subject)));

  useEffect(() => {
    // Re-sync when the subject changes (a new track, a new participant, a new room).
    setState(latest.current.read(subject));

    if (!subject) return;

    const unsubscribers = Object.keys(latest.current.handlers).map(event =>
      subscribe(subject as EventSource, event, (...eventArgs: any[]) =>
        setState(latest.current.handlers[event](subject as NonNullable<Subject>, ...eventArgs))
      )
    );
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [subject, latest]);

  return state;
}

import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { SessionEndApi } from './useSessionEnd';

/**
 * Bridge that lets components mounted NEXT TO <Room/> (the legacy mobile MenuBar and
 * MobileTopMenuBar) reach the teacher's end-of-class actions without calling
 * useSessionEnd a second time — that hook owns a class data-channel subscription and
 * must run exactly once, in Room.tsx. Room publishes the api here; App provides the slot.
 */

interface SessionEndSlot {
  api: SessionEndApi | null;
  publish: (api: SessionEndApi | null) => void;
}

const SessionEndContext = createContext<SessionEndSlot>({ api: null, publish: () => undefined });

export function SessionEndProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<SessionEndApi | null>(null);
  const value = useMemo(() => ({ api, publish: setApi }), [api]);
  return <SessionEndContext.Provider value={value}>{children}</SessionEndContext.Provider>;
}

/** Room.tsx: publish the (single) useSessionEnd result for the sibling mobile bars. */
export function usePublishSessionEnd({ endSessionForAll, leaveWithoutEnding, isEnding }: SessionEndApi) {
  const { publish } = useContext(SessionEndContext);
  useEffect(() => {
    publish({ endSessionForAll, leaveWithoutEnding, isEnding });
  }, [publish, endSessionForAll, leaveWithoutEnding, isEnding]);
  useEffect(() => () => publish(null), [publish]);
}

/** The published api, or null outside Room / before it has mounted. */
export function useSessionEndApi(): SessionEndApi | null {
  return useContext(SessionEndContext).api;
}

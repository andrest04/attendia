import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Bridge for the student's screen-share grant, mirroring SessionEndProvider: the grant is
 * received by useModeration, which must run exactly once (Room.tsx), but the controls that
 * need it live both inside Room (toolbars) and next to it (the legacy mobile MenuBar). Room
 * publishes the value here; App provides the slot.
 *
 * Without a provider (unit tests, Storybook) the value is null = "no grant source, do not
 * gate". Under a provider it starts false: a student with no message is NOT allowed.
 */

interface GrantSlot {
  allowed: boolean | null;
  publish: (allowed: boolean) => void;
}

export const ScreenShareGrantContext = createContext<GrantSlot>({ allowed: null, publish: () => undefined });

export function ScreenShareGrantProvider({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const value = useMemo(() => ({ allowed, publish: setAllowed }), [allowed]);
  return <ScreenShareGrantContext.Provider value={value}>{children}</ScreenShareGrantContext.Provider>;
}

/** Room.tsx: publish the (single) grant received by useModeration. */
export function usePublishScreenShareGrant(allowed: boolean) {
  const { publish } = useContext(ScreenShareGrantContext);
  useEffect(() => {
    publish(allowed);
  }, [publish, allowed]);
  useEffect(() => () => publish(false), [publish]);
}

/** The published grant, or null when there is no provider (not gated). */
export function useScreenShareGrant(): boolean | null {
  return useContext(ScreenShareGrantContext).allowed;
}

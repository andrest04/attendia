import { useCallback, useReducer } from 'react';
import { ProfessorRightTab } from './ProfessorRoomShell/professorShellHelpers';

/**
 * Mediator for the two side rails of the desktop shells. The toolbar chips, the rail × buttons
 * and the right-rail tabs all want to open or close a rail, and the rails are not independent:
 * on narrow desktops (below `md`) the fixed-width rails would squeeze the stage to a sliver, so
 * opening one rail closes the other. That rule lives here, in one place, instead of being
 * re-implemented inside every toolbar callback.
 */

export interface RoomLayoutState {
  leftOpen: boolean;
  rightOpen: boolean;
  /** Which tab the right rail shows. Students only ever have `chat`. */
  rightTab: ProfessorRightTab;
}

/** Both rails start collapsed (Meet-style clean entry); the toolbar opens them. */
export const initialRoomLayout: RoomLayoutState = { leftOpen: false, rightOpen: false, rightTab: 'grupo' };

/** What a toolbar chip stands for: the chat tab, or the attention cockpit (Grupo/Individual). */
export type RightPanel = 'chat' | 'attention';

export type RoomLayoutAction =
  | { type: 'toggleLeft'; narrow: boolean }
  | { type: 'toggleRight'; narrow: boolean; panel?: RightPanel }
  | { type: 'closeLeft' }
  | { type: 'closeRight' }
  | { type: 'setRightTab'; tab: ProfessorRightTab };

// Is the right rail open on the tab this panel stands for?
const isShowing = (state: RoomLayoutState, panel: RightPanel | undefined) => {
  if (!state.rightOpen) return false;
  if (panel === undefined) return true;
  return panel === 'chat' ? state.rightTab === 'chat' : state.rightTab !== 'chat';
};

export function roomLayoutReducer(state: RoomLayoutState, action: RoomLayoutAction): RoomLayoutState {
  switch (action.type) {
    case 'toggleLeft': {
      const leftOpen = !state.leftOpen;
      return { ...state, leftOpen, rightOpen: leftOpen && action.narrow ? false : state.rightOpen };
    }
    case 'toggleRight': {
      // Pressing the chip of the panel that is already showing closes the rail...
      if (isShowing(state, action.panel)) return { ...state, rightOpen: false };
      // ...otherwise it opens the rail on that panel (a chip without a panel keeps the tab).
      const rightTab = action.panel === undefined ? state.rightTab : action.panel === 'chat' ? 'chat' : 'grupo';
      return { leftOpen: action.narrow ? false : state.leftOpen, rightOpen: true, rightTab };
    }
    case 'closeLeft':
      return { ...state, leftOpen: false };
    case 'closeRight':
      return { ...state, rightOpen: false };
    case 'setRightTab':
      return { ...state, rightTab: action.tab };
  }
}

/**
 * @param isNarrowDesktop Between 600-960px the desktop shells still render, but their rails are
 *   fixed-width — with both open the stage could shrink to a sliver, so only one stays open.
 */
export function useRoomLayout(isNarrowDesktop: boolean) {
  const [state, dispatch] = useReducer(roomLayoutReducer, initialRoomLayout);

  const toggleLeft = useCallback(() => dispatch({ type: 'toggleLeft', narrow: isNarrowDesktop }), [isNarrowDesktop]);
  const closeLeft = useCallback(() => dispatch({ type: 'closeLeft' }), []);
  const closeRight = useCallback(() => dispatch({ type: 'closeRight' }), []);
  const setRightTab = useCallback((tab: ProfessorRightTab) => dispatch({ type: 'setRightTab', tab }), []);
  const toggleRight = useCallback(
    (panel?: RightPanel) => dispatch({ type: 'toggleRight', narrow: isNarrowDesktop, panel }),
    [isNarrowDesktop]
  );

  return { ...state, toggleLeft, closeLeft, closeRight, setRightTab, toggleRight };
}

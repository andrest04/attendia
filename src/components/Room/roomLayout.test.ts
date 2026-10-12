import { renderHook, act } from '@testing-library/react-hooks';
import { initialRoomLayout, RoomLayoutState, roomLayoutReducer, useRoomLayout } from './roomLayout';

const state = (overrides: Partial<RoomLayoutState> = {}): RoomLayoutState => ({ ...initialRoomLayout, ...overrides });

describe('roomLayoutReducer', () => {
  it('starts with both rails closed on the group tab', () => {
    expect(initialRoomLayout).toEqual({ leftOpen: false, rightOpen: false, rightTab: 'grupo' });
  });

  describe('toggleLeft', () => {
    it('opens and closes the left rail', () => {
      const opened = roomLayoutReducer(state(), { type: 'toggleLeft', narrow: false });
      expect(opened.leftOpen).toBe(true);
      expect(roomLayoutReducer(opened, { type: 'toggleLeft', narrow: false }).leftOpen).toBe(false);
    });

    it('keeps the right rail open on wide desktops', () => {
      const next = roomLayoutReducer(state({ rightOpen: true }), { type: 'toggleLeft', narrow: false });
      expect(next).toMatchObject({ leftOpen: true, rightOpen: true });
    });

    it('closes the right rail when the left one opens on a narrow desktop', () => {
      const next = roomLayoutReducer(state({ rightOpen: true }), { type: 'toggleLeft', narrow: true });
      expect(next).toMatchObject({ leftOpen: true, rightOpen: false });
    });

    it('leaves the right rail alone when the left one closes on a narrow desktop', () => {
      const next = roomLayoutReducer(state({ leftOpen: true, rightOpen: true }), { type: 'toggleLeft', narrow: true });
      expect(next).toMatchObject({ leftOpen: false, rightOpen: true });
    });
  });

  describe('toggleRight without a panel (the student chat chip)', () => {
    it('opens the rail and keeps the tab', () => {
      const next = roomLayoutReducer(state({ rightTab: 'individual' }), { type: 'toggleRight', narrow: false });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'individual' });
    });

    it('closes the rail when it is already open', () => {
      const next = roomLayoutReducer(state({ rightOpen: true }), { type: 'toggleRight', narrow: false });
      expect(next.rightOpen).toBe(false);
    });

    it('closes the left rail first on a narrow desktop', () => {
      const next = roomLayoutReducer(state({ leftOpen: true }), { type: 'toggleRight', narrow: true });
      expect(next).toMatchObject({ leftOpen: false, rightOpen: true });
    });

    it('keeps the left rail on a wide desktop', () => {
      const next = roomLayoutReducer(state({ leftOpen: true }), { type: 'toggleRight', narrow: false });
      expect(next).toMatchObject({ leftOpen: true, rightOpen: true });
    });
  });

  describe('toggleRight with a panel (the professor chips)', () => {
    it('opens the chat panel on the chat tab', () => {
      const next = roomLayoutReducer(state(), { type: 'toggleRight', narrow: false, panel: 'chat' });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'chat' });
    });

    it('closes the rail when the chat panel is already showing', () => {
      const next = roomLayoutReducer(state({ rightOpen: true, rightTab: 'chat' }), {
        type: 'toggleRight',
        narrow: false,
        panel: 'chat',
      });
      expect(next.rightOpen).toBe(false);
    });

    it('switches from attention to chat instead of closing', () => {
      const next = roomLayoutReducer(state({ rightOpen: true, rightTab: 'individual' }), {
        type: 'toggleRight',
        narrow: false,
        panel: 'chat',
      });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'chat' });
    });

    it('opens the attention panel on the group tab', () => {
      const next = roomLayoutReducer(state(), { type: 'toggleRight', narrow: false, panel: 'attention' });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'grupo' });
    });

    it('closes the rail when any attention tab is already showing', () => {
      ['grupo', 'individual'].forEach(rightTab => {
        const next = roomLayoutReducer(state({ rightOpen: true, rightTab: rightTab as RoomLayoutState['rightTab'] }), {
          type: 'toggleRight',
          narrow: false,
          panel: 'attention',
        });
        expect(next.rightOpen).toBe(false);
      });
    });

    it('switches from chat to attention instead of closing', () => {
      const next = roomLayoutReducer(state({ rightOpen: true, rightTab: 'chat' }), {
        type: 'toggleRight',
        narrow: false,
        panel: 'attention',
      });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'grupo' });
    });

    it('opens on the requested tab even when the rail is closed on another one', () => {
      const next = roomLayoutReducer(state({ rightOpen: false, rightTab: 'chat' }), {
        type: 'toggleRight',
        narrow: false,
        panel: 'attention',
      });
      expect(next).toMatchObject({ rightOpen: true, rightTab: 'grupo' });
    });

    it('closes the left rail first on a narrow desktop', () => {
      const next = roomLayoutReducer(state({ leftOpen: true }), { type: 'toggleRight', narrow: true, panel: 'chat' });
      expect(next).toMatchObject({ leftOpen: false, rightOpen: true, rightTab: 'chat' });
    });
  });

  it('closes each rail independently', () => {
    const open = state({ leftOpen: true, rightOpen: true });
    expect(roomLayoutReducer(open, { type: 'closeLeft' })).toMatchObject({ leftOpen: false, rightOpen: true });
    expect(roomLayoutReducer(open, { type: 'closeRight' })).toMatchObject({ leftOpen: true, rightOpen: false });
  });

  it('changes the right tab without touching the rails', () => {
    const next = roomLayoutReducer(state({ rightOpen: true }), { type: 'setRightTab', tab: 'individual' });
    expect(next).toEqual({ leftOpen: false, rightOpen: true, rightTab: 'individual' });
  });
});

describe('useRoomLayout', () => {
  it('binds the narrow-desktop flag into the toggles', () => {
    const { result, rerender } = renderHook(({ narrow }) => useRoomLayout(narrow), { initialProps: { narrow: false } });

    act(() => result.current.toggleRight());
    act(() => result.current.toggleLeft());
    expect(result.current).toMatchObject({ leftOpen: true, rightOpen: true });

    act(() => result.current.closeLeft());
    rerender({ narrow: true });
    act(() => result.current.toggleLeft());
    expect(result.current).toMatchObject({ leftOpen: true, rightOpen: false });
  });

  it('exposes stable close and tab handlers', () => {
    const { result, rerender } = renderHook(() => useRoomLayout(false));
    const { closeLeft, closeRight, setRightTab } = result.current;

    act(() => result.current.toggleRight('chat'));
    rerender();

    expect(result.current.closeLeft).toBe(closeLeft);
    expect(result.current.closeRight).toBe(closeRight);
    expect(result.current.setRightTab).toBe(setRightTab);
    expect(result.current.rightTab).toBe('chat');
  });
});

import { useCallback, useState } from 'react';

/**
 * State of a confirm dialog: whether it is open, and what it is about.
 *
 * The target is kept apart from the open flag on purpose: MUI's Dialog plays a ~225ms exit
 * transition with its content still mounted, so clearing the target at the same time as closing
 * would flash "undefined" in the message mid-animation. `close()` therefore leaves the target as
 * it was; the next `open(target)` replaces it. For dialogs that are not about anything, use
 * `useConfirmDialog()` and `open()`.
 */
export default function useConfirmDialog<T = undefined>() {
  const [target, setTarget] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((nextTarget?: T) => {
    if (nextTarget !== undefined) setTarget(nextTarget);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  return { target, isOpen, open, close };
}

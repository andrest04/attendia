import React from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

/**
 * Toolbar button that opens the "Mi Atención" side panel.
 * Mirrors the ToggleChatButton pattern: opening this panel closes
 * the background-selection dialog, and vice-versa.
 */
export default function ToggleAttentionButton() {
  const { isAttentionPanelOpen, setIsAttentionPanelOpen, setIsChatWindowOpen } = useChatContext();
  const { setIsBackgroundSelectionOpen } = useVideoContext();
  const classes = useToolbarButtonStyles();

  const togglePanel = () => {
    const willOpen = !isAttentionPanelOpen;
    setIsAttentionPanelOpen(willOpen);
    if (willOpen) {
      // Close competing panels so only one right-drawer is open at a time.
      setIsChatWindowOpen(false);
      setIsBackgroundSelectionOpen(false);
    }
  };

  return (
    <Button
      onClick={togglePanel}
      startIcon={<VisibilityIcon />}
      data-testid="toggle-attention-button"
      aria-label="Mi Atención"
      className={clsx(classes.toolbarButton, { [classes.toolbarButtonActive]: isAttentionPanelOpen })}
    >
      Mi Atención
    </Button>
  );
}

import React from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import CollaborationViewIcon from '@material-ui/icons/AccountBox';
import GridViewIcon from '@material-ui/icons/Apps';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import { useAppState } from '../../../state';

/**
 * Lets a student flip between gallery view and speaker view from their toolbar,
 * the same control the professor has. Label and icon advertise the view this
 * button switches TO, mirroring the professor toolbar's view chip and the
 * legacy menu.
 */
export default function ToggleViewButton(props: { disabled?: boolean; className?: string }) {
  const { isGalleryViewActive, setIsGalleryViewActive } = useAppState();
  const classes = useToolbarButtonStyles();

  return (
    <Button
      className={clsx(classes.toolbarButton, props.className)}
      onClick={() => setIsGalleryViewActive(isGallery => !isGallery)}
      disabled={props.disabled}
      startIcon={isGalleryViewActive ? <CollaborationViewIcon /> : <GridViewIcon />}
      data-testid="student-toolbar-view"
    >
      {isGalleryViewActive ? 'Vista de orador' : 'Vista de galería'}
    </Button>
  );
}

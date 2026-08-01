import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@material-ui/core';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared confirm/cancel modal for destructive dashboard actions (class cancel,
 * resource delete) — replaces window.confirm so the prompt matches the app's
 * MUI theme instead of the browser's native dialog. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isConfirming = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} data-testid="dashboard-confirm-dialog">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="dashboard-confirm-dialog-cancel">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          disabled={isConfirming}
          autoFocus
          data-testid="dashboard-confirm-dialog-confirm"
        >
          {isConfirming ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

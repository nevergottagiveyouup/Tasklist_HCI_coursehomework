import React from 'react';
import { Button } from './Button';
import { useTheme } from '../context/ThemeContext';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel
}) => {
  const { styles } = useTheme();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      <div className={`${styles.surface} rounded-xl shadow-2xl w-[320px] p-5 space-y-4`} onClick={(e) => e.stopPropagation()}>
        <div className="text-sm leading-relaxed">{message}</div>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            className="bg-gray-300 hover:bg-gray-400 text-slate-700 border-gray-300"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="bg-red-500 hover:bg-red-600 border-red-500"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

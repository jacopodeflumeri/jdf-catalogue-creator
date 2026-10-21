'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import ConfirmDialog from '@/components/ui/modal/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState {
  isOpen: boolean;
  isLoading: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmState: ConfirmState;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    isLoading: false,
    options: { title: '', message: '' },
    onConfirm: () => {},
    onCancel: () => {}
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const handleConfirm = async () => {
        setState(prev => ({ ...prev, isLoading: true }));
        resolve(true);
        setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
      };

      const handleCancel = () => {
        resolve(false);
        setState(prev => ({ ...prev, isOpen: false }));
      };

      setState({
        isOpen: true,
        isLoading: false,
        options,
        onConfirm: handleConfirm,
        onCancel: handleCancel
      });
    });
  };

  return (
    <ConfirmContext.Provider value={{ confirm, confirmState: state }}>
      {children}
      <ConfirmDialog
        isOpen={state.isOpen}
        onClose={state.onCancel}
        onConfirm={state.onConfirm}
        title={state.options.title}
        message={state.options.message}
        confirmText={state.options.confirmText}
        cancelText={state.options.cancelText}
        variant={state.options.variant}
        isLoading={state.isLoading}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  isLoading = false
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Icon type="warning" className="text-[#932231]" size="lg" />,
          iconBg: 'bg-[rgba(224,85,102,0.16)] border border-white/75',
          confirmButtonClass: 'bg-[rgba(224,85,102,0.86)] hover:bg-[rgba(224,85,102,0.96)]'
        };
      case 'warning':
        return {
          icon: <Icon type="info" className="text-[#7D581C]" size="lg" />,
          iconBg: 'bg-[rgba(216,162,74,0.2)] border border-white/75',
          confirmButtonClass: 'bg-[rgba(216,162,74,0.86)] hover:bg-[rgba(216,162,74,0.96)]'
        };
      default:
        return {
          icon: <Icon type="info" className="text-primary" size="lg" />,
          iconBg: 'bg-[rgba(141,119,247,0.16)] border border-white/75',
          confirmButtonClass: 'prism-button'
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title" 
      role="dialog" 
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-[rgba(26,26,26,0.16)] backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={handleBackdropClick}
        ></div>

        {/* Modal panel */}
        <div className="relative glass-modal rounded-3xl px-8 pt-8 pb-6 text-left overflow-hidden transform transition-all max-w-lg w-full">
          <div className="flex items-start">
            <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${variantStyles.iconBg}`}>
              {variantStyles.icon}
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg leading-6 font-medium text-[#1a1a1a]" id="modal-title">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-[#1a1a1a]/60">
                  {message}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-row-reverse gap-3">
            <Button
              type="button"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={onConfirm}
              disabled={isLoading}
              loading={isLoading}
            >
              {confirmText}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-[#1a1a1a]/82"
            >
              {cancelText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

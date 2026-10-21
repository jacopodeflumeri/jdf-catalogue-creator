'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export type NoticeBoxVariant = 'info' | 'success' | 'warning' | 'error' | 'primary' | 'neutral';

interface NoticeBoxProps {
  variant?: NoticeBoxVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
  icon?: string;
}

const variantStyles: Record<NoticeBoxVariant, {
  container: string;
  iconColor: string;
  defaultIcon: string;
}> = {
  info: {
    container: 'glass-surface bg-[rgba(77,139,201,0.12)] text-[rgba(42,80,117,0.96)]',
    iconColor: 'text-[rgba(56,98,142,0.95)]',
    defaultIcon: 'info'
  },
  success: {
    container: 'glass-surface bg-[rgba(74,159,126,0.12)] text-[rgba(42,104,82,0.96)]',
    iconColor: 'text-[rgba(42,115,88,0.95)]',
    defaultIcon: 'check-circle'
  },
  warning: {
    container: 'glass-surface bg-[rgba(216,162,74,0.17)] text-[rgba(120,82,25,0.96)]',
    iconColor: 'text-[rgba(125,88,28,0.96)]',
    defaultIcon: 'warning'
  },
  error: {
    container: 'glass-surface bg-[rgba(224,85,102,0.14)] text-[rgba(137,38,51,0.96)]',
    iconColor: 'text-[rgba(147,34,49,0.96)]',
    defaultIcon: 'exclamation'
  },
  primary: {
    container: 'glass-surface bg-[rgba(141,119,247,0.14)] text-[rgba(96,71,201,0.95)]',
    iconColor: 'text-primary',
    defaultIcon: 'info'
  },
  neutral: {
    container: 'glass-surface bg-[rgba(255,255,255,0.3)] text-[rgba(26,26,26,0.82)]',
    iconColor: 'text-[rgba(26,26,26,0.62)]',
    defaultIcon: 'info'
  }
};

export default function NoticeBox({
  variant = 'info',
  title,
  children,
  className = '',
  showIcon = true,
  icon
}: NoticeBoxProps) {
  const styles = variantStyles[variant];
  const iconToShow = icon || styles.defaultIcon;

  return (
    <div className={`p-4 rounded-2xl ${styles.container} ${className}`}>
      <div className="flex items-start space-x-3">
        {showIcon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon 
              type={iconToShow as any} 
              size="sm" 
              className={styles.iconColor}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold mb-1">
              {title}
            </h4>
          )}
          <div className="text-sm leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
  className?: string;
  contentClassName?: string;
  allowWrap?: boolean;
  color?: 'dark' | 'light' | 'primary' | 'success' | 'warning' | 'error' | 'info';
}

const colorClasses = {
  dark: {
    bubble: 'bg-[rgba(26,26,26,0.92)] text-white border border-white/15',
    arrow: 'bg-[rgba(26,26,26,0.92)]',
  },
  light: {
    bubble: 'bg-white/88 text-[#1a1a1a] border border-white/90 shadow-[0_8px_20px_rgba(0,0,0,0.08)]',
    arrow: 'bg-white/88',
  },
  primary: {
    bubble: 'bg-[rgba(141,119,247,0.94)] text-white border border-white/20',
    arrow: 'bg-[rgba(141,119,247,0.94)]',
  },
  success: {
    bubble: 'bg-[rgba(74,159,126,0.93)] text-white border border-white/20',
    arrow: 'bg-[rgba(74,159,126,0.93)]',
  },
  warning: {
    bubble: 'bg-[rgba(216,162,74,0.93)] text-white border border-white/20',
    arrow: 'bg-[rgba(216,162,74,0.93)]',
  },
  error: {
    bubble: 'bg-[rgba(224,85,102,0.93)] text-white border border-white/20',
    arrow: 'bg-[rgba(224,85,102,0.93)]',
  },
  info: {
    bubble: 'bg-[rgba(77,139,201,0.93)] text-white border border-white/20',
    arrow: 'bg-[rgba(77,139,201,0.93)]',
  },
} as const;

const positionClasses = {
  top: {
    bubble: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    arrow: 'top-full left-1/2 -translate-x-1/2',
  },
  bottom: {
    bubble: 'top-full left-1/2 -translate-x-1/2 mt-2',
    arrow: 'bottom-full left-1/2 -translate-x-1/2',
  },
  left: {
    bubble: 'right-full top-1/2 -translate-y-1/2 mr-2',
    arrow: 'left-full top-1/2 -translate-y-1/2',
  },
  right: {
    bubble: 'left-full top-1/2 -translate-y-1/2 ml-2',
    arrow: 'right-full top-1/2 -translate-y-1/2',
  },
  'top-left': {
    bubble: 'bottom-full right-0 mb-2',
    arrow: 'top-full right-3',
  },
  'top-right': {
    bubble: 'bottom-full left-0 mb-2',
    arrow: 'top-full left-3',
  },
  'bottom-left': {
    bubble: 'top-full right-0 mt-2',
    arrow: 'bottom-full right-3',
  },
  'bottom-right': {
    bubble: 'top-full left-0 mt-2',
    arrow: 'bottom-full left-3',
  },
} as const;

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  className = '',
  contentClassName = '',
  allowWrap = false,
  color = 'light',
}) => {
  const selectedColor = colorClasses[color];
  const selectedPosition = positionClasses[position];

  return (
    <div className={`relative inline-flex group ${className}`}>
      {children}
      <div
        className={`pointer-events-none absolute ${selectedPosition.bubble} ${selectedColor.bubble} px-3 py-2 text-xs rounded-xl backdrop-blur-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 z-10 ${allowWrap ? 'w-max max-w-[220px] text-center' : 'whitespace-nowrap'} ${contentClassName}`}
      >
        {content}
        <div
          className={`absolute h-2.5 w-2.5 rotate-45 ${selectedPosition.arrow} ${selectedColor.arrow}`}
        />
      </div>
    </div>
  );
};

export default Tooltip;

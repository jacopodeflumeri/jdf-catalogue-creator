'use client';

import React from 'react';

export interface FilterOptionProps {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * FilterOption - A styled button component for filter selections
 * Designed to be used inside FilterDropdown components
 */
export default function FilterOption({
  label,
  count,
  isActive,
  onClick,
  className = '',
  size = 'md'
}: FilterOptionProps) {

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2 py-1.5',
    lg: 'px-2 py-1.5',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-between gap-3 rounded-xl
        font-medium ${sizeClasses[size]} transition-all duration-300 whitespace-nowrap border
        ${isActive
          ? 'prism-button text-white border-white/15'
          : 'frost-button text-[#1a1a1a]/75 border-transparent hover:text-[#1a1a1a]'
        }
        ${className}
      `}
    >
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className={`
          px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0
          ${isActive ? 'bg-white/25 text-white' : 'bg-white/55 border border-white/75 text-[#1a1a1a]/65'}
        `}>
          {count}
        </span>
      )}
    </button>
  );
}

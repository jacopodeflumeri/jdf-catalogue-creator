'use client';

import React from 'react';
import Icon, { IconType } from './Icon';

export type ButtonToggleSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonToggle {
  value: string;
  label: string;
  icon?: IconType;
}

export interface ButtonToggleGroupProps {
  buttons: ButtonToggle[];
  value: string;
  onChange: (value: string) => void;
  size?: ButtonToggleSize;
  className?: string;
}

const sizeClasses: Record<ButtonToggleSize, { button: string; icon: 'xs' | 'sm' | 'md' | 'lg'; text: string }> = {
  xs: {
    button: 'px-2 py-1',
    icon: 'xs',
    text: 'text-xs'
  },
  sm: {
    button: 'px-2 py-2',
    icon: 'sm',
    text: 'text-xs'
  },
  md: {
    button: 'px-4 py-2.5',
    icon: 'sm',
    text: 'text-base'
  },
  lg: {
    button: 'px-5 py-3',
    icon: 'md',
    text: 'text-lg'
  }
};

/**
 * ButtonToggleGroup - A group of toggle buttons that touch in the middle
 * Perfect for view mode toggles, filter options, or any segmented control
 * 
 * @example
 * // Simple view mode toggle
 * <ButtonToggleGroup
 *   buttons={[
 *     { value: 'list', label: 'List', icon: 'menu' },
 *     { value: 'grid', label: 'Grid', icon: 'layout' }
 *   ]}
 *   value={viewMode}
 *   onChange={setViewMode}
 *   size="sm"
 * />
 * 
 * @example
 * // Multiple options toggle
 * <ButtonToggleGroup
 *   buttons={[
 *     { value: 'day', label: 'Day' },
 *     { value: 'week', label: 'Week' },
 *     { value: 'month', label: 'Month' },
 *     { value: 'year', label: 'Year' }
 *   ]}
 *   value={timeRange}
 *   onChange={setTimeRange}
 *   size="md"
 * />
 */
export default function ButtonToggleGroup({
  buttons,
  value,
  onChange,
  size = 'sm',
  className = ''
}: ButtonToggleGroupProps) {
  const sizeConfig = sizeClasses[size];

  return (
    <div className={`flex items-center bg-white/35 border border-white/65 rounded-2xl p-1 backdrop-blur-sm ${className}`}>
      {buttons.map((button) => {
        const isActive = value === button.value;

        return (
          <button
            key={button.value}
            onClick={() => onChange(button.value)}
            className={`
              ${sizeConfig.button}
              ${sizeConfig.text}
              flex items-center gap-2 font-medium transition-all duration-300 rounded-xl border
              ${isActive
                ? 'prism-button text-white border-white/20'
                : 'frost-button text-[#1a1a1a]/65 border-transparent hover:text-[#1a1a1a]'
              }
            `}
            type="button"
          >
            {button.icon && (
              <Icon type={button.icon} size={sizeConfig.icon} />
            )}
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
